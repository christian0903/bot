# Handoffs — passages de relais entre sessions

Les handoffs du projet bot s'écrivent **ici** depuis le 2026-08-23, et non plus
dans le vault Obsidian.

## À quoi ça sert

Le vault est synchronisé entre le Mac mini et le MacBook ; l'historique des
conversations Claude, non. Un handoff fait le pont : écrit à la clôture d'une
session sur une machine, relu au démarrage sur l'autre. Il dit où on en était,
ce qui a été décidé, et la prochaine action — assez pour reprendre sans deviner.

## Comment ça marche

Dire « handoff » ou « on clôture la session » déclenche le skill `handoff` :
il propose un brouillon, attend votre validation, puis écrit ici. Dire « handoff
reprise » ou « on reprend où on en était » le fait relire.

Nom des fichiers : `handoff-YYYY-MM-DD-HHmm-<slug>.md`.

## Ce qui continue de vivre dans le vault

Votre **daily note** garde un résumé de 2 à 3 lignes des journées passées sur
l'application — le journal reste complet. Elle renvoie ici par un chemin
(`→ détail : ~/bot/docs/handoffs/…`) et non par un `[[wikilink]]`, la cible
étant hors du vault. Elle ne porte plus de ligne `Projet :` pour ce projet : la
note de pilotage a été rapatriée dans `docs/vault-import/`.

## Les anciens

Les six handoffs du 5 au 9 août sont dans `docs/vault-import/handoffs/`. Ils ont
été copiés depuis le vault, où ils existent encore — c'est à vous de les y
supprimer.
