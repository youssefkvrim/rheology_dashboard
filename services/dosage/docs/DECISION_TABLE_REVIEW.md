# Revue metier - table de decision dosage eau

Phase D3 demande une revue metier avant toute integration dashboard D4. Ce document liste les 27 scenarios actuels du moteur, les cas marques en conflit, les rapports de backtest, et les blocs de validation a completer par le responsable procede. Les agents logiciels ne valident pas la physique procede.

Legende statuts: H = haut, C = conforme, L = bas. Proprietes: D = densite, V = viscosite, PC = pouvoir couvrant.

| # | D | V | PC | Decision | Conflit | Rationale metier a valider |
|---:|:-:|:-:|:-:|:--|:--:|:--|
| 1 | H | H | H | INCREASE | Non | Les trois mesures indiquent une barbotine trop chargee; ajouter de l'eau va dans le sens attendu. |
| 2 | H | H | C | INCREASE | Non | Densite et viscosite hautes dominent; la dilution est l'action prioritaire. |
| 3 | H | H | L | INCREASE | Non | Densite et viscosite hautes priment sur le PC bas; action a surveiller car PC pourrait encore baisser. |
| 4 | H | C | H | INCREASE | Non | Densite et PC hauts indiquent une concentration trop forte; dilution recommandee. |
| 5 | H | C | C | INCREASE | Non | Seule la densite haute sort de la plage; ajouter peu d'eau corrige directement. |
| 6 | H | C | L | INCREASE | Oui | Densite haute pousse a ajouter de l'eau, mais PC bas pousse a reduire la dilution; validation metier requise. |
| 7 | H | L | H | INCREASE | Non | Densite et PC hauts dominent malgre une viscosite basse; dilution graduelle a confirmer. |
| 8 | H | L | C | INCREASE | Oui | Densite haute et viscosite basse demandent des actions opposees; l'eau seule peut etre insuffisante. |
| 9 | H | L | L | INCREASE | Oui | Densite haute pousse a diluer alors que viscosite et PC bas signalent un risque inverse; arbitrage metier requis. |
| 10 | C | H | H | INCREASE | Non | Viscosite et PC hauts indiquent une correction par dilution. |
| 11 | C | H | C | INCREASE | Non | La viscosite haute est l'ecart principal; ajouter de l'eau doit la ramener vers la plage. |
| 12 | C | H | L | MAINTAIN | Oui | Viscosite haute et PC bas sont contradictoires pour l'eau; maintenir evite une correction aveugle. |
| 13 | C | C | H | INCREASE | Non | Le PC haut seul est traite par une dilution prudente. |
| 14 | C | C | C | MAINTAIN | Non | Toutes les mesures sont conformes; aucun changement d'eau n'est justifie. |
| 15 | C | C | L | DECREASE | Non | PC bas seul signale une dilution a ralentir; reduire le debit limite l'ajout d'eau futur. |
| 16 | C | L | H | MAINTAIN | Oui | Viscosite basse et PC haut tirent dans des directions opposees; maintien et revue metier. |
| 17 | C | L | C | MAINTAIN | Non | Viscosite basse seule ne justifie pas une correction eau immediate selon la table actuelle. |
| 18 | C | L | L | MAINTAIN | Non | Viscosite et PC bas invitent a eviter plus d'eau; maintien limite le risque de sur-correction. |
| 19 | L | H | H | DECREASE | Oui | Densite basse pousse a reduire l'eau, mais viscosite et PC hauts poussent a diluer; conflit procede. |
| 20 | L | H | C | DECREASE | Oui | Densite basse et viscosite haute sont contradictoires; la table privilegie la densite avec alerte. |
| 21 | L | H | L | DECREASE | Non | Densite et PC bas indiquent trop d'eau; reduire le debit est coherent malgre la viscosite haute. |
| 22 | L | C | H | DECREASE | Oui | Densite basse demande moins d'eau, PC haut demande plus de dilution; validation metier requise. |
| 23 | L | C | C | DECREASE | Non | Densite basse seule indique une dilution excessive; reduire le debit limite les prochains apports. |
| 24 | L | C | L | DECREASE | Non | Densite et PC bas indiquent trop d'eau; baisse du debit recommandee. |
| 25 | L | L | H | DECREASE | Non | Densite et viscosite basses dominent; reduire l'eau future est l'action coherente. |
| 26 | L | L | C | DECREASE | Non | Densite et viscosite basses signalent une barbotine trop diluee; ralentir l'eau. |
| 27 | L | L | L | DECREASE | Non | Les trois mesures sont basses; la priorite est de stopper la dilution supplementaire. |

## Rapports de backtest

- [M73006](backtests/backtest_report_M73006.md)
- [2CN2005](backtests/backtest_report_2CN2005.md)
- [R55012ITG](backtests/backtest_report_R55012ITG.md)

## Sign-off table decision

Valide par: ____ Date: ____ Modifications demandees: ____

## Sign-off materiel doseur

Valide par: ____ Date: ____ Modifications demandees: ____
