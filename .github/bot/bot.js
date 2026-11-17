// Bot « Travail en équipe » (I324, S3).
// Chaque élève réalise une issue (user story), la fait relire, relit celle d'un camarade, puis fusionne.
// Le bot lit l'état du dépôt par l'API GitHub et répond dans l'issue de l'élève.
// Sa progression est notée dans ses commentaires (<!-- progression:N -->) : rien n'est stocké ailleurs.
'use strict';

const env = process.env;
const REPO = env.REPO;
const PROPRIO = (env.PROPRIO || '').toLowerCase();
const EVT = JSON.parse(require('fs').readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
const NOM_EVT = env.EVENEMENT;
const LABEL = 'story';

// ---------------------------------------------------------------------------------------------
// API GitHub
// ---------------------------------------------------------------------------------------------
async function api(methode, chemin, corps) {
    const r = await fetch(`https://api.github.com/repos/${REPO}${chemin}`, {
        method: methode,
        headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: corps ? JSON.stringify(corps) : undefined,
    });
    if (r.status === 204) return null;
    const t = await r.text();
    if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
}
const get = (c) => api('GET', c);
async function tout(chemin) {
    const res = [];
    for (let p = 1; p <= 10; p++) {
        const page = await get(`${chemin}${chemin.includes('?') ? '&' : '?'}per_page=100&page=${p}`);
        res.push(...page);
        if (page.length < 100) break;
    }
    return res;
}

const min = (s) => String(s || '').toLowerCase();
const normaliser = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const RE_CONV = /^(feat|fix|docs|test|refactor|style|chore|build|ci|perf)(\([^)]+\))?!?: \S/;

// ---------------------------------------------------------------------------------------------
// Données du dépôt, lues une seule fois par exécution
// ---------------------------------------------------------------------------------------------
const cache = {};
const issues = async () => (cache.issues = cache.issues || (await tout('/issues?state=all')).filter((i) => !i.pull_request));
const prs = async () => (cache.prs = cache.prs || await tout('/pulls?state=all'));
const avis = async (n) => (cache['r' + n] = cache['r' + n] || await tout(`/pulls/${n}/reviews`));
const commentairesLigne = async (n) => (cache['c' + n] = cache['c' + n] || await tout(`/pulls/${n}/comments`));
const lireFichier = async (ref, f) => {
    try { const r = await get(`/contents/${encodeURIComponent(f).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`); return Buffer.from(r.content, 'base64').toString('utf8'); } catch { return null; }
};

// La route demandée par une issue : « Route : `GET /api/count` »
function routeDe(issue) {
    const m = /Route\s*:\s*`(GET|POST|PUT|DELETE) ([^`]+)`/i.exec(issue.body || '');
    return m ? { methode: m[1].toLowerCase(), chemin: m[2] } : null;
}

// ---------------------------------------------------------------------------------------------
// État d'un élève
// ---------------------------------------------------------------------------------------------
async function etat(pseudo) {
    const e = { pseudo };
    const toutes = await issues();
    e.stories = toutes.filter((i) => i.labels.some((l) => l.name === LABEL) && i.assignees.some((a) => min(a.login) === pseudo));
    e.issue = e.stories.length === 1 ? e.stories[0] : null;
    if (!e.issue) return e;
    const n = e.issue.number;
    e.route = routeDe(e.issue);

    // Branches de l'élève pour cette issue
    const branches = (await tout('/branches')).map((b) => b.name);
    e.branchesMalNommees = branches.filter((b) => new RegExp(`(^|/|-)${n}(-|$)`).test(b) && !b.startsWith(`feature/${n}-`));
    e.branche = branches.find((b) => new RegExp(`^feature/${n}-[a-z0-9]+(-[a-z0-9]+)*$`).test(b)) || null;
    e.brancheInvalide = branches.find((b) => b.startsWith(`feature/${n}-`) && b !== e.branche) || null;

    // La pull request de l'élève
    const lesPrs = (await prs()).filter((p) => min(p.user.login) === pseudo);
    e.pr = lesPrs.find((p) => p.head.ref === e.branche) || lesPrs.find((p) => new RegExp(`#${n}\\b`).test(p.body || '')) || null;
    if (!e.branche && e.pr && e.pr.merged_at) e.branche = e.pr.head.ref;

    e.commits = [];
    e.fichiers = [];
    e.headSha = null;
    if (e.pr) {
        // Une fois la PR ouverte, on lit ses commits et ses fichiers (valable aussi après fusion)
        const pr = await get(`/pulls/${e.pr.number}`);
        e.pr = pr;
        e.headSha = pr.head.sha;
        e.commits = await tout(`/pulls/${pr.number}/commits`);
        e.fichiers = await tout(`/pulls/${pr.number}/files`);
    } else if (e.branche) {
        try {
            const cmp = await get(`/compare/main...${encodeURIComponent(e.branche)}`);
            e.commits = cmp.commits || [];
            e.fichiers = cmp.files || [];
            e.headSha = e.commits.length ? e.commits[e.commits.length - 1].sha : null;
        } catch { /* branche illisible */ }
    }
    if (e.branche && !(e.pr && e.pr.merged_at)) {
        try { e.retard = (await get(`/compare/${encodeURIComponent(e.branche)}...main`)).ahead_by; } catch { e.retard = null; }
    }
    return e;
}

// ---------------------------------------------------------------------------------------------
// Les missions : verifier(e) renvoie { ok, aide }
// ---------------------------------------------------------------------------------------------
const OK = { ok: true };
const MISSIONS = [
    {
        titre: 'Prendre une issue',
        consigne: () => ['Suivez la mission 1 du README.'],
        verifier: async (e) => {
            if (e.stories.length === 0) return { ok: false, aide: 'Vous n\'êtes assigné à aucune issue `story`. Ouvrez l\'onglet **Issues**, choisissez une issue sans personne dans **Assignees**, et cliquez sur **assign yourself**.' };
            if (e.stories.length > 1) return { ok: false, aide: `Vous êtes assigné à ${e.stories.length} issues : ${e.stories.map((i) => '#' + i.number).join(', ')}. Une seule par personne : retirez-vous des autres.` };
            return OK;
        },
        bilan: (e) => [
            `L'issue #${e.issue.number} est à vous. Une **issue**, c'est une demande suivie dans le dépôt : un besoin, une discussion, une personne responsable, un état (ouverte ou fermée).`,
            'La vôtre est rédigée comme une **user story** (« En tant que…, je veux…, afin de… ») avec des **critères d\'acceptation** : ce qui doit être vrai pour que la demande soit considérée comme faite.',
        ],
    },
    {
        titre: 'Une branche liée à l\'issue',
        consigne: (e) => [
            'Lisez votre issue et `CONTRIBUTING.md` (les règles de l\'équipe).',
            `Créez votre branche depuis \`origin/main\` en respectant la convention, faites un premier commit qui cite \`#${e.issue.number}\` dans son message, puis poussez.`,
            'Un premier commit peut être simple, par exemple le fichier de la route, même vide.',
        ],
        verifier: async (e) => {
            if (e.brancheInvalide) return { ok: false, aide: `La branche \`${e.brancheInvalide}\` ne respecte pas la convention : minuscules, tirets, sans accent ni espace (voir \`CONTRIBUTING.md\`).` };
            if (!e.branche && e.branchesMalNommees.length) return { ok: false, aide: `La branche \`${e.branchesMalNommees[0]}\` ne respecte pas la convention de l'équipe. Relisez \`CONTRIBUTING.md\`.` };
            if (!e.branche) return { ok: false, aide: `Je ne trouve pas votre branche sur GitHub. Relisez la convention dans \`CONTRIBUTING.md\` : elle commence par \`feature/${e.issue.number}-\`. N'oubliez pas de pousser.` };
            const miens = e.commits.filter((c) => c.author && min(c.author.login) === e.pseudo);
            if (!miens.length) return { ok: false, aide: 'Votre branche ne contient encore aucun commit de vous.' };
            if (!miens.some((c) => new RegExp(`#${e.issue.number}\\b`).test(c.commit.message))) return { ok: false, aide: `Aucun de vos commits ne cite \`#${e.issue.number}\`. Ajoutez-le dans le message de votre prochain commit.` };
            return OK;
        },
        bilan: (e) => [
            `Votre commit apparaît maintenant dans l'issue #${e.issue.number} : GitHub relie tout seul un commit à l'issue qu'il cite. Dans six mois, quelqu'un pourra retrouver **pourquoi** ce code existe.`,
            'C\'est la **traçabilité** : chaque changement est relié à un besoin, chaque besoin aux changements qui le réalisent.',
        ],
    },
    {
        titre: 'Réaliser la user story',
        consigne: (e) => [
            `Réalisez la route demandée dans l'issue #${e.issue.number} et enregistrez-la dans \`src/index.js\`.`,
            'Écrivez **un test par critère d\'acceptation** dans un nouveau fichier de `spec/routes/`. Les tests existants vous servent de modèle.',
            'Vérifiez sur votre PC avec `npm test`, puis poussez. La CI de l\'équipe doit être verte.',
        ],
        verifier: async (e) => {
            const ajoutes = e.fichiers.filter((f) => f.status === 'added').map((f) => f.filename);
            if (!ajoutes.some((f) => /^src\/routes\/.+\.js$/.test(f))) return { ok: false, aide: 'Je ne vois pas de nouveau fichier dans `src/routes/` sur votre branche.' };
            const specs = ajoutes.filter((f) => /^spec\/.+\.spec\.js$/.test(f));
            if (!specs.length) return { ok: false, aide: 'Je ne vois pas de nouveau fichier de tests dans `spec/routes/`.' };
            let nb = 0;
            for (const f of specs) nb += ((await lireFichier(e.headSha, f)) || '').match(/\b(test|it)\s*\(/g)?.length || 0;
            const nbCriteres = ((e.issue.body || '').match(/^- \[[ x]\]/gm) || []).length || 3;
            if (nb < nbCriteres) return { ok: false, aide: `Votre issue a ${nbCriteres} critères d'acceptation, je ne compte que ${nb} test(s). Un test par critère.` };
            if (e.route) {
                const index = (await lireFichier(e.headSha, 'src/index.js')) || '';
                const ch = e.route.chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (!new RegExp(`app\\.${e.route.methode}\\(\\s*['"\`]${ch}['"\`]`).test(index)) return { ok: false, aide: `La route \`${e.route.methode.toUpperCase()} ${e.route.chemin}\` n'est pas enregistrée dans \`src/index.js\` (regardez comment les routes existantes le sont).` };
            }
            if (!e.headSha) return { ok: false, aide: 'Poussez votre travail.' };
            const runs = (await get(`/actions/runs?head_sha=${e.headSha}&per_page=20`)).workflow_runs.filter((r) => r.name === 'CI');
            if (!runs.length || runs[0].status !== 'completed') return { ok: false, aide: 'La CI tourne encore sur votre dernier commit. Je vous réponds quand elle est terminée.', attendre: true };
            if (runs[0].conclusion !== 'success') return { ok: false, aide: 'La CI de votre dernier commit est rouge. Ouvrez l\'onglet **Actions** et lisez l\'étape en échec.' };
            return OK;
        },
        bilan: () => [
            'La user story est réalisée **et prouvée** : chaque critère d\'acceptation a son test, et la CI les rejoue à chaque push. Un critère sans test, c\'est une promesse que personne ne vérifie.',
        ],
    },
    {
        titre: 'Ouvrir la pull request',
        consigne: (e) => [
            'Sur la page du dépôt, ouvrez une **pull request** de votre branche vers `main`.',
            '- Titre au format des commits (voir `CONTRIBUTING.md`).',
            `- Description : remplissez le modèle proposé, sans oublier \`Closes #${e.issue.number}\`.`,
        ],
        verifier: async (e) => {
            if (!e.pr) return { ok: false, aide: 'Je ne trouve pas de pull request ouverte depuis votre branche.' };
            if (!RE_CONV.test(e.pr.title)) return { ok: false, aide: `Le titre « ${e.pr.title} » ne respecte pas le format des commits. Modifiez-le (bouton **Edit** à côté du titre).` };
            if (!new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?) #${e.issue.number}\\b`, 'i').test(e.pr.body || '')) return { ok: false, aide: `La description ne contient pas \`Closes #${e.issue.number}\`. Sans ça, l'issue ne se fermera pas toute seule à la fusion.` };
            const tester = /comment tester[\s\S]*?\n([\s\S]*?)(\n## |$)/i.exec(e.pr.body || '');
            if (!tester || !tester[1].replace(/<!--[\s\S]*?-->/g, '').trim()) return { ok: false, aide: 'La partie « Comment tester » est vide. Le relecteur doit savoir comment vérifier votre travail.' };
            return OK;
        },
        bilan: (e) => [
            `Votre pull request est liée à l'issue #${e.issue.number} : regardez la colonne de droite de l'issue, la PR y apparaît.`,
            'Une **pull request** est une demande d\'intégration : « voici mon travail, relisez-le avant qu\'il entre dans `main` ». La règle de l\'équipe interdit de fusionner sans CI verte **et** sans l\'approbation d\'un camarade.',
            'Je vous attribue la pull request d\'un camarade à relire dès qu\'une est disponible. Vous la trouverez dans **Pull requests** › **Review requests**.',
        ],
    },
    {
        titre: 'Relire un camarade',
        consigne: () => [
            'Ouvrez la pull request que je vous ai attribuée, avec son issue à côté. Onglet **Files changed** :',
            '- vérifiez chaque critère d\'acceptation, et qu\'il a son test ;',
            '- écrivez **au moins un commentaire sur une ligne** (survolez la ligne, cliquez sur le **+**) ;',
            '- puis **Review changes** : **Approve** si tout est bon, sinon **Request changes**.',
            'Pas encore de pull request attribuée ? Relisez n\'importe quelle pull request ouverte d\'un camarade.',
        ],
        verifier: async (e) => {
            for (const p of await prs()) {
                if (min(p.user.login) === e.pseudo) continue;
                const decides = (await avis(p.number)).filter((r) => min(r.user.login) === e.pseudo && ['APPROVED', 'CHANGES_REQUESTED'].includes(r.state));
                if (!decides.length) continue;
                const lignes = (await commentairesLigne(p.number)).filter((c) => min(c.user.login) === e.pseudo);
                if (lignes.length) return OK;
                return { ok: false, aide: `Votre revue de la pull request #${p.number} ne contient aucun commentaire sur une ligne de code. Ajoutez-en un dans **Files changed** (le **+** au survol d'une ligne).` };
            }
            return { ok: false, aide: 'Je ne vois encore aucune revue terminée de votre part (**Approve** ou **Request changes**) sur la pull request d\'un camarade.' };
        },
        bilan: () => [
            'Relire, c\'est partager la responsabilité du code : si un bug passe, il est passé devant deux personnes. Une bonne revue est polie, précise (une ligne, un problème) et propose une solution.',
        ],
    },
    {
        titre: 'Obtenir l\'approbation',
        consigne: () => [
            'Lisez la revue reçue sur votre pull request. Si on vous demande des modifications : corrigez, poussez, répondez au commentaire, puis demandez une nouvelle revue (icône ↻ à côté du nom du relecteur).',
            'Personne ne vous a encore relu ? Demandez à votre enseignant.',
        ],
        verifier: async (e) => {
            const recues = (await avis(e.pr.number)).filter((r) => min(r.user.login) !== e.pseudo && ['APPROVED', 'CHANGES_REQUESTED'].includes(r.state));
            if (!recues.length) return { ok: false, aide: 'Votre pull request n\'a encore reçu aucune revue.' };
            const derniere = {};
            for (const r of recues) derniere[min(r.user.login)] = r.state;
            if (Object.values(derniere).includes('CHANGES_REQUESTED')) return { ok: false, aide: 'Des modifications vous sont demandées. Corrigez, poussez, puis redemandez une revue.' };
            return OK;
        },
        bilan: () => ['Votre travail est approuvé. Il reste une condition pour entrer dans `main`.'],
    },
    {
        titre: 'Se mettre à jour avec main',
        consigne: () => [
            'Pendant que vous travailliez, d\'autres ont fusionné dans `main`. La règle de l\'équipe : une branche doit être **à jour** avec `main` avant d\'y entrer.',
            'Sur votre PC, dans votre branche :',
            '```',
            'git fetch',
            'git merge origin/main',
            '```',
            'S\'il y a un **conflit**, VS Code vous montre les deux versions : gardez les deux routes, retirez les marqueurs `<<<<<<<`, `=======` et `>>>>>>>`, vérifiez avec `npm test`, puis commit et push.',
        ],
        verifier: async (e) => {
            if (e.pr && e.pr.merged_at) return OK;
            if (e.retard === null || e.retard === undefined) return { ok: false, aide: 'Je n\'arrive pas à comparer votre branche avec `main`.' };
            if (e.retard > 0) return { ok: false, aide: `Votre branche a ${e.retard} commit(s) de retard sur \`main\`.` };
            return OK;
        },
        bilan: () => [
            'Votre branche contient maintenant tout `main` plus votre travail : ce qui sera testé est exactement ce qui entrera dans `main`. Un **conflit** arrive quand deux personnes modifient les mêmes lignes : Git ne choisit pas à votre place.',
        ],
    },
    {
        titre: 'Fusionner',
        consigne: () => ['Quand la CI est verte, cliquez sur **Merge pull request** dans votre pull request.'],
        verifier: async (e) => {
            if (!e.pr.merged_at) return { ok: false, aide: 'Votre pull request n\'est pas encore fusionnée.' };
            const i = (await issues()).find((x) => x.number === e.issue.number);
            if (i && i.state !== 'closed') return { ok: false, aide: `L'issue #${e.issue.number} est restée ouverte : la description de la PR contenait-elle \`Closes #${e.issue.number}\` au moment de la fusion ? Fermez-la à la main.` };
            return OK;
        },
        bilan: (e) => [
            `Fusionné, et l'issue #${e.issue.number} s'est fermée toute seule. De la demande au code dans \`main\`, chaque étape est visible : issue → branche → commits → revue → fusion.`,
            'Il reste une mission bonus.',
        ],
    },
    {
        titre: 'Bonus : signaler un bug',
        consigne: () => [
            'Pendant les revues, vous avez peut-être vu un défaut : une route qui plante, un cas non prévu. Ouvrez une **issue de bug** avec trois parties : **Étapes pour reproduire**, **Résultat attendu**, **Résultat obtenu**.',
        ],
        verifier: async (e) => {
            const bugs = (await issues()).filter((i) => min(i.user.login) === e.pseudo && !i.labels.some((l) => l.name === LABEL));
            if (!bugs.length) return { ok: false, aide: 'Je ne vois pas d\'issue ouverte par vous.' };
            if (!bugs.some((i) => { const b = normaliser(i.body || ''); return /etape/.test(b) && /attendu/.test(b) && /obtenu/.test(b); })) return { ok: false, aide: 'Votre issue doit contenir les trois parties : étapes pour reproduire, résultat attendu, résultat obtenu.' };
            return OK;
        },
        bilan: () => ['Un bon rapport de bug fait gagner des heures : celui qui le lit peut reproduire le problème sans vous poser de question.'],
    },
];

async function evaluer(pseudo) {
    const e = await etat(pseudo);
    let reussies = 0;
    let aide = '';
    let attendre = false;
    for (const m of MISSIONS) {
        const r = await m.verifier(e);
        if (!r.ok) { aide = r.aide; attendre = !!r.attendre; break; }
        reussies++;
    }
    return { e, reussies, aide, attendre };
}

// ---------------------------------------------------------------------------------------------
// Réponses
// ---------------------------------------------------------------------------------------------
async function progressionNotee(issue) {
    let p = 0;
    for (const c of await tout(`/issues/${issue.number}/comments`)) {
        const m = /<!-- progression:(\d+) -->/.exec(c.body || '');
        if (m && c.user.type === 'Bot') p = Math.max(p, Number(m[1]));
    }
    return p;
}

async function repondre(pseudo, { aideSi = [], toujours = false } = {}) {
    const { e, reussies, aide, attendre } = await evaluer(pseudo);
    const n = MISSIONS.length;
    const avant = e.issue ? await progressionNotee(e.issue) : 0;
    const L = [`@${pseudo}`, '', `**Progression : ${reussies} sur ${n}**`, ''];
    if (reussies > avant) {
        for (let i = avant; i < reussies; i++) L.push(`### Mission ${i + 1} réussie : ${MISSIONS[i].titre}`, '', ...MISSIONS[i].bilan(e).flatMap((x) => [x, '']));
        if (reussies === n) L.push('### Terminé', '', 'Toutes les missions sont réussies, bonus compris. Montrez ce message à votre enseignant.');
        else L.push(`### Mission ${reussies + 1} : ${MISSIONS[reussies].titre}`, '', ...MISSIONS[reussies].consigne(e), '');
    } else if (reussies < n && !attendre && (toujours || aideSi.includes(reussies + 1))) {
        L.push(`### Mission ${reussies + 1} : pas encore`, '', `> ${aide}`, '');
        if (reussies > 0) L.push('<details><summary>Rappel de la consigne</summary>', '', ...MISSIONS[reussies].consigne(e), '', '</details>', '');
    } else {
        return;
    }
    L.push(`<!-- progression:${reussies} -->`);
    const corps = L.join('\n');
    if (e.issue) await api('POST', `/issues/${e.issue.number}/comments`, { body: corps });
    else if (EVT.pull_request) await api('POST', `/issues/${EVT.pull_request.number}/comments`, { body: corps });
    else if (EVT.head_commit) await api('POST', `/commits/${EVT.head_commit.id}/comments`, { body: corps });
    console.log(`Réponse à ${pseudo} : ${reussies}/${n}`);
}

// Attribue un relecteur : deux auteurs en attente se relisent l'un l'autre
async function attribuerRelecteurs() {
    const ouvertes = (await prs()).filter((p) => p.state === 'open' && min(p.user.login) !== PROPRIO);
    const occupe = new Set(ouvertes.flatMap((p) => p.requested_reviewers.map((r) => min(r.login))));
    for (const p of ouvertes) for (const r of await avis(p.number)) occupe.add(min(r.user.login));
    const enAttente = [];
    for (const p of ouvertes) {
        const sansRelecteur = p.requested_reviewers.length === 0 && (await avis(p.number)).length === 0;
        if (sansRelecteur && !occupe.has(min(p.user.login))) enAttente.push(p);
    }
    while (enAttente.length >= 2) {
        const a = enAttente.shift(), b = enAttente.shift();
        await api('POST', `/pulls/${a.number}/requested_reviewers`, { reviewers: [b.user.login] });
        await api('POST', `/pulls/${b.number}/requested_reviewers`, { reviewers: [a.user.login] });
        for (const [x, y] of [[a, b], [b, a]]) {
            const ex = await etat(min(x.user.login));
            if (ex.issue) await api('POST', `/issues/${ex.issue.number}/comments`, { body: `@${x.user.login}\n\nJe vous ai attribué la pull request #${y.number} à relire. Elle est aussi dans **Pull requests** › **Review requests**.` });
        }
    }
}

// ---------------------------------------------------------------------------------------------
async function main() {
    const acteur = min(env.ACTEUR);
    if (!acteur || acteur.endsWith('[bot]')) return;
    const eleve = (login) => min(login) !== PROPRIO;

    switch (NOM_EVT) {
    case 'issues': {
        if (EVT.action === 'assigned' && eleve(EVT.assignee.login)) await repondre(min(EVT.assignee.login), { aideSi: [1, 2] });
        if (EVT.action === 'opened' && eleve(acteur)) await repondre(acteur, { aideSi: [9] });
        break;
    }
    case 'push': {
        if (eleve(acteur) && EVT.ref !== 'refs/heads/main' && !EVT.deleted) await repondre(acteur, { aideSi: [1, 2, 7] });
        break;
    }
    case 'workflow_run': {
        const auteur = min(EVT.workflow_run.actor.login);
        if (eleve(auteur)) await repondre(auteur, { aideSi: [3] });
        break;
    }
    case 'pull_request_target': {
        const p = EVT.pull_request;
        if (['opened', 'reopened', 'ready_for_review'].includes(EVT.action)) await attribuerRelecteurs();
        if (eleve(p.user.login)) await repondre(min(p.user.login), { aideSi: EVT.action === 'closed' ? [8] : [4] });
        break;
    }
    case 'pull_request_review': {
        if (eleve(acteur)) await repondre(acteur, { aideSi: [5] });
        const auteur = min(EVT.pull_request.user.login);
        if (eleve(auteur) && auteur !== acteur) await repondre(auteur, { aideSi: [6] });
        break;
    }
    default:
        break;
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
