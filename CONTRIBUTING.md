# Règles de l'équipe

## Branches

`feature/<numéro de l'issue>-<description>`, en minuscules, avec des tirets, sans accent ni espace.

Exemple : `feature/12-compter-les-taches`

## Commits

Format des Conventional Commits : `type: description`, par exemple `feat: ajoute la route de recherche`.
Chaque commit cite l'issue qu'il réalise : `#12` dans le message.

## Pull requests

- Titre au même format qu'un commit.
- La description dit ce qui change, comment le tester, et contient `Closes #<numéro>`.
- On ne fusionne dans `main` qu'avec une CI verte, une approbation, et une branche à jour avec `main`.

## Revue

- On relit le code d'un camarade ligne par ligne, avec l'issue et ses critères à côté.
- Un commentaire de revue est poli, précis, et propose une solution.
- On approuve seulement si tous les critères sont remplis et testés.
