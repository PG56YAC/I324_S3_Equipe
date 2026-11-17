# I324 – S3 – Travail en équipe

Toute la classe travaille sur la même application de liste de tâches. Chaque issue du dépôt est une demande d'un utilisateur, rédigée comme une **user story**, avec ses critères d'acceptation.

Votre travail : prendre une demande, la réaliser, la faire relire par un camarade, relire le travail d'un autre, puis faire entrer votre code dans `main`, en respectant les règles de l'équipe ([CONTRIBUTING.md](CONTRIBUTING.md)).

`main` est protégée : on n'y entre qu'avec une CI verte, l'approbation d'un camarade et une branche à jour.

Un **bot** suit votre travail et vous répond dans votre issue, par e-mail, avec la mission suivante.

## Avant de commencer

Si votre PC n'est pas encore prêt (Git, Node.js, identité Git, notifications), suivez d'abord [INSTALLATION.md](INSTALLATION.md).

## Mission 1 : prendre une issue

1. **Cloner** le dépôt dans VS Code (`Ctrl+Shift+P` › **Git: Clone**), avec l'adresse donnée par l'enseignant, puis ouvrir le dossier et lancer `npm install` dans le terminal.
2. Onglet **Issues** du dépôt : choisissez une issue qui n'est assignée à personne (colonne **Assignees** vide).
3. Dans l'issue, à droite, **Assignees** › **assign yourself**.

Une seule issue par personne. Le bot vous répond dans votre issue quelques secondes plus tard.

## Règles du jeu

- Vous ne poussez jamais directement sur `main`.
- Vous ne modifiez pas les fichiers de `.github/`.
- Pas de réponse du bot après une minute ? Regardez l'onglet **Actions**, puis demandez à l'enseignant.

---

Application d'origine : [docker/getting-started-app](https://github.com/docker/getting-started-app), licence MIT.
