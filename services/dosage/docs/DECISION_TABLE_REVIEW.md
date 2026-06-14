# Revue métier - table de décision dosage eau

Phase D3 demande une revue métier avant toute intégration dashboard D4. Ce document liste les 27 scénarios actuels du moteur, les cas marqués en conflit, les rapports de backtest, et les blocs de validation à compléter par le responsable procédé. Les agents logiciels ne valident pas la physique procédé.

Légende statuts: H = haut, C = conforme, L = bas. Propriétés: D = densité, V = viscosité, PC = pouvoir couvrant.

| # | D | V | PC | Décision | Conflit | Rationale métier à valider |
|---:|:-:|:-:|:-:|:--|:--:|:--|
| 1 | H | H | H | INCREASE | Non | Les trois mesures indiquent une barbotine trop chargée; ajouter de l'eau va dans le sens attendu. |
| 2 | H | H | C | INCREASE | Non | Densité et viscosité hautes dominent; la dilution est l'action prioritaire. |
| 3 | H | H | L | INCREASE | Non | Densité et viscosité hautes priment sur le PC bas; action à surveiller car PC pourrait encore baisser. |
| 4 | H | C | H | INCREASE | Non | Densité et PC hauts indiquent une concentration trop forte; dilution recommandée. |
| 5 | H | C | C | INCREASE | Non | Seule la densité haute sort de la plage; ajouter peu d'eau corrige directement. |
| 6 | H | C | L | INCREASE | Oui | Densité haute pousse à ajouter de l'eau, mais PC bas pousse à réduire la dilution; validation métier requise. |
| 7 | H | L | H | INCREASE | Non | Densité et PC hauts dominent malgré une viscosité basse; dilution graduelle à confirmer. |
| 8 | H | L | C | INCREASE | Oui | Densité haute et viscosité basse demandent des actions opposées; l'eau seule peut être insuffisante. |
| 9 | H | L | L | INCREASE | Oui | Densité haute pousse à diluer alors que viscosité et PC bas signalent un risque inverse; arbitrage métier requis. |
| 10 | C | H | H | INCREASE | Non | Viscosité et PC hauts indiquent une correction par dilution. |
| 11 | C | H | C | INCREASE | Non | La viscosité haute est l'écart principal; ajouter de l'eau doit la ramener vers la plage. |
| 12 | C | H | L | MAINTAIN | Oui | Viscosité haute et PC bas sont contradictoires pour l'eau; maintenir évite une correction aveugle. |
| 13 | C | C | H | INCREASE | Non | Le PC haut seul est traité par une dilution prudente. |
| 14 | C | C | C | MAINTAIN | Non | Toutes les mesures sont conformes; aucun changement d'eau n'est justifié. |
| 15 | C | C | L | DECREASE | Non | PC bas seul signale une dilution à ralentir; réduire le débit limite l'ajout d'eau futur. |
| 16 | C | L | H | MAINTAIN | Oui | Viscosité basse et PC haut tirent dans des directions opposées; maintien et revue métier. |
| 17 | C | L | C | MAINTAIN | Non | Viscosité basse seule ne justifie pas une correction eau immédiate selon la table actuelle. |
| 18 | C | L | L | MAINTAIN | Non | Viscosité et PC bas invitent à éviter plus d'eau; maintien limite le risque de sur-correction. |
| 19 | L | H | H | DECREASE | Oui | Densité basse pousse à réduire l'eau, mais viscosité et PC hauts poussent à diluer; conflit procédé. |
| 20 | L | H | C | DECREASE | Oui | Densité basse et viscosité haute sont contradictoires; la table privilégie la densité avec alerte. |
| 21 | L | H | L | DECREASE | Non | Densité et PC bas indiquent trop d'eau; réduire le débit est cohérent malgré la viscosité haute. |
| 22 | L | C | H | DECREASE | Oui | Densité basse demande moins d'eau, PC haut demande plus de dilution; validation métier requise. |
| 23 | L | C | C | DECREASE | Non | Densité basse seule indique une dilution excessive; réduire le débit limite les prochains apports. |
| 24 | L | C | L | DECREASE | Non | Densité et PC bas indiquent trop d'eau; baisse du débit recommandée. |
| 25 | L | L | H | DECREASE | Non | Densité et viscosité basses dominent; réduire l'eau future est l'action cohérente. |
| 26 | L | L | C | DECREASE | Non | Densité et viscosité basses signalent une barbotine trop diluée; ralentir l'eau. |
| 27 | L | L | L | DECREASE | Non | Les trois mesures sont basses; la priorité est de stopper la dilution supplémentaire. |

## Rapports de backtest

- [M73006](backtests/backtest_report_M73006.md)
- [2CN2005](backtests/backtest_report_2CN2005.md)
- [R55012ITG](backtests/backtest_report_R55012ITG.md)

## Sign-off table decision

Validé par: ____ Date: ____ Modifications demandées: ____

## Sign-off matériel doseur

Validé par: ____ Date: ____ Modifications demandées: ____
