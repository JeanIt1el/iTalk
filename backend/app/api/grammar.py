import json
import re
import unicodedata

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings

router = APIRouter(prefix="/grammar", tags=["Grammar"])
settings = get_settings()
GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"


class EnrichmentRequest(BaseModel):
    focus: str = Field(default="", max_length=500)


class ExerciseCheckRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=1000)


ROADMAPS = {
    "A1": {
        "title": "Premiers repères",
        "description": "Construire des phrases simples et parler de soi au présent et au passé.",
        "categories": [
            {"id": "sentence-basics", "title": "Construire une phrase", "topics": [
                {"id": "a1-be", "title": "Le verbe be", "duration_minutes": 12,
                 "rule": "Be signifie être. Au présent, il prend la forme am avec I, is avec he/she/it et are avec you/we/they. La négation se forme avec not et la question en inversant le sujet et le verbe.",
                 "examples": [{"english": "I am a student.", "french": "Je suis étudiant(e)."}, {"english": "They aren't at home.", "french": "Ils ne sont pas à la maison."}, {"english": "Is she your teacher?", "french": "Est-elle votre professeure ?"}],
                 "exceptions": ["On contracte souvent is not en isn't et are not en aren't.", "Les réponses courtes reprennent be : Yes, I am. / No, she isn't."]},
                {"id": "a1-word-order", "title": "Ordre des mots et questions simples", "duration_minutes": 10,
                 "rule": "La phrase affirmative suit généralement sujet + verbe + complément. Pour une question avec be, placez le verbe avant le sujet ; avec un autre verbe au présent, utilisez do ou does.",
                 "examples": [{"english": "We live in Paris.", "french": "Nous vivons à Paris."}, {"english": "Do you like tea?", "french": "Aimez-vous le thé ?"}, {"english": "Where does he work?", "french": "Où travaille-t-il ?"}],
                 "exceptions": ["Les mots interrogatifs (what, where, when) se placent au début.", "Avec be, n'ajoutez pas do : Are you ready ?"]},
            ]},
            {"id": "present-and-nouns", "title": "Présent et noms", "topics": [
                {"id": "a1-present-simple", "title": "Present simple", "duration_minutes": 14,
                 "rule": "Utilisez le present simple pour les habitudes et les faits. Ajoutez généralement -s à la troisième personne du singulier ; utilisez do/does pour les questions et don't/doesn't pour la négation.",
                 "examples": [{"english": "I take the bus every day.", "french": "Je prends le bus tous les jours."}, {"english": "She studies English.", "french": "Elle étudie l'anglais."}, {"english": "He doesn't drink coffee.", "french": "Il ne boit pas de café."}],
                 "exceptions": ["Après does/doesn't, le verbe reste à la base : Does she work ?", "Les verbes terminés par consonne + y prennent -ies : study → studies."]},
                {"id": "a1-articles-plurals", "title": "Articles et pluriels", "duration_minutes": 11,
                 "rule": "Un nom singulier dénombrable prend a devant un son consonne et an devant un son voyelle. Le pluriel prend le plus souvent -s.",
                 "examples": [{"english": "a book, an apple", "french": "un livre, une pomme"}, {"english": "three buses", "french": "trois bus"}, {"english": "The children are here.", "french": "Les enfants sont ici."}],
                 "exceptions": ["Le choix de a/an dépend du son, pas de la lettre : an hour, a university.", "Certains pluriels sont irréguliers : child → children, man → men."]},
            ]},
            {"id": "describing-and-locating", "title": "Décrire et situer", "topics": [
                {"id": "a1-adjectives", "title": "Adjectifs et démonstratifs", "duration_minutes": 9,
                 "rule": "L'adjectif se place généralement avant le nom et ne s'accorde pas. This/that désignent un élément singulier, these/those plusieurs éléments.",
                 "examples": [{"english": "a small house", "french": "une petite maison"}, {"english": "These shoes are new.", "french": "Ces chaussures sont neuves."}, {"english": "That is an interesting book.", "french": "C'est un livre intéressant."}],
                 "exceptions": ["Après be, l'adjectif peut se placer seul : The house is small.", "That peut aussi reprendre une idée entière : That's great."]},
                {"id": "a1-prepositions", "title": "Prépositions de lieu et de temps", "duration_minutes": 10,
                 "rule": "In, on et at situent dans l'espace comme dans le temps : in pour un espace ou une période, on pour une surface ou un jour, at pour un point ou une heure précise.",
                 "examples": [{"english": "in London, in July", "french": "à Londres, en juillet"}, {"english": "on the table, on Monday", "french": "sur la table, lundi"}, {"english": "at the station, at 8 o'clock", "french": "à la gare, à 8 heures"}],
                 "exceptions": ["On dit at home, mais in the house.", "Les prépositions ne se traduisent pas toujours mot à mot du français."]},
            ]},
        ],
    },
    "A2": {
        "title": "Parler du quotidien",
        "description": "Raconter des expériences simples, comparer et exprimer ses projets.",
        "categories": [
            {"id": "past", "title": "Raconter le passé", "topics": [
                {"id": "a2-past-simple", "title": "Past simple", "duration_minutes": 14,
                 "rule": "Le past simple décrit une action terminée dans le passé. Les verbes réguliers prennent -ed ; les verbes irréguliers ont une forme propre. Les questions utilisent did + base verbale.",
                 "examples": [{"english": "We visited York last summer.", "french": "Nous avons visité York l'été dernier."}, {"english": "She went home early.", "french": "Elle est rentrée tôt."}, {"english": "Did you see the match?", "french": "As-tu vu le match ?"}],
                 "exceptions": ["Après did/didn't, utilisez la base verbale : didn't go, pas didn't went.", "Les verbes en consonne + y prennent -ied : carry → carried."]},
                {"id": "a2-past-continuous", "title": "Past continuous", "duration_minutes": 12,
                 "rule": "Formez le past continuous avec was/were + verbe en -ing. Il décrit une action en cours à un moment passé, souvent interrompue par une action au past simple.",
                 "examples": [{"english": "I was cooking at six.", "french": "Je cuisinais à six heures."}, {"english": "They were walking when it started to rain.", "french": "Ils marchaient quand il s'est mis à pleuvoir."}, {"english": "What were you doing?", "french": "Qu'est-ce que tu faisais ?"}],
                 "exceptions": ["Les verbes d'état comme know ou believe s'emploient rarement en -ing.", "On double parfois la consonne finale : sit → sitting."]},
            ]},
            {"id": "future-and-quantity", "title": "Projets et quantités", "topics": [
                {"id": "a2-future", "title": "Futur : going to et will", "duration_minutes": 12,
                 "rule": "Going to exprime souvent un projet ou une intention ; will sert aux décisions spontanées, promesses et prédictions. Les deux se construisent avec be ou will + base verbale.",
                 "examples": [{"english": "We're going to move next month.", "french": "Nous allons déménager le mois prochain."}, {"english": "I'll answer the phone.", "french": "Je vais répondre au téléphone."}, {"english": "It will probably snow.", "french": "Il neigera probablement."}],
                 "exceptions": ["Une prédiction fondée sur un indice visible favorise going to : It's going to fall!", "Après if et when, on utilise souvent le présent pour parler du futur : when I arrive."]},
                {"id": "a2-quantifiers", "title": "Quantifieurs", "duration_minutes": 10,
                 "rule": "Much s'emploie avec les noms indénombrables, many avec les dénombrables. Some apparaît souvent dans les affirmations ; any dans les questions et négations.",
                 "examples": [{"english": "How much time do we have?", "french": "Combien de temps avons-nous ?"}, {"english": "There are many people here.", "french": "Il y a beaucoup de monde ici."}, {"english": "Would you like some water?", "french": "Voulez-vous de l'eau ?"}],
                 "exceptions": ["Some est courant dans une offre ou une demande polie.", "A lot of est naturel avec les noms dénombrables et indénombrables."]},
            ]},
            {"id": "compare-and-connect", "title": "Comparer et relier", "topics": [
                {"id": "a2-comparatives", "title": "Comparatifs et superlatifs", "duration_minutes": 11,
                 "rule": "Les adjectifs courts prennent -er/-est ; les adjectifs longs utilisent more/most. Le comparatif se construit avec than, le superlatif avec the.",
                 "examples": [{"english": "This route is shorter than the other one.", "french": "Cet itinéraire est plus court que l'autre."}, {"english": "It is the most useful app.", "french": "C'est l'application la plus utile."}, {"english": "Today is better.", "french": "Aujourd'hui, c'est mieux."}],
                 "exceptions": ["Good devient better/best et bad devient worse/worst.", "On double parfois la consonne : big → bigger."]},
                {"id": "a2-connectors", "title": "Connecteurs de base", "duration_minutes": 9,
                 "rule": "And ajoute une idée, but oppose deux idées, because donne une cause et so introduit une conséquence.",
                 "examples": [{"english": "I was tired, so I went home.", "french": "J'étais fatigué, alors je suis rentré."}, {"english": "She stayed because it was raining.", "french": "Elle est restée parce qu'il pleuvait."}, {"english": "It's small but comfortable.", "french": "C'est petit mais confortable."}],
                 "exceptions": ["Because of est suivi d'un nom ; because est suivi d'une proposition.", "Évitez d'enchaîner plusieurs phrases avec and dans un texte formel."]},
            ]},
        ],
    },
    "B1": {
        "title": "Gagner en autonomie",
        "description": "Nuancer les temps, relier les idées et parler de situations hypothétiques.",
        "categories": [
            {"id": "tense-contrasts", "title": "Temps et expériences", "topics": [
                {"id": "b1-present-perfect", "title": "Present perfect et past simple", "duration_minutes": 15,
                 "rule": "Le present perfect relie une expérience ou un résultat au présent (have/has + participe passé). Le past simple situe une action dans une période passée terminée.",
                 "examples": [{"english": "I've visited Dublin twice.", "french": "J'ai visité Dublin deux fois."}, {"english": "I visited Dublin in 2022.", "french": "J'ai visité Dublin en 2022."}, {"english": "She has just arrived.", "french": "Elle vient d'arriver."}],
                 "exceptions": ["Un repère passé terminé (yesterday, in 2020) appelle le past simple.", "Been to exprime une visite terminée ; gone to signifie que la personne n'est pas encore revenue."]},
                {"id": "b1-present-perfect-continuous", "title": "Present perfect continuous", "duration_minutes": 13,
                 "rule": "Have/has been + -ing met l'accent sur la durée ou l'activité récente qui explique une situation présente.",
                 "examples": [{"english": "I've been learning English for three years.", "french": "J'apprends l'anglais depuis trois ans."}, {"english": "She's tired because she's been working.", "french": "Elle est fatiguée parce qu'elle travaille depuis un moment."}, {"english": "How long have you been waiting?", "french": "Depuis combien de temps attendez-vous ?"}],
                 "exceptions": ["For indique une durée ; since indique son point de départ.", "Les verbes d'état prennent généralement le present perfect simple : I've known her for years."]},
            ]},
            {"id": "modality", "title": "Modalité et hypothèses", "topics": [
                {"id": "b1-modals", "title": "Obligation, conseil et possibilité", "duration_minutes": 12,
                 "rule": "Must exprime une obligation forte, have to une nécessité, should un conseil et might une possibilité. Un modal est suivi de la base verbale sans to.",
                 "examples": [{"english": "You should get some rest.", "french": "Tu devrais te reposer."}, {"english": "We have to leave now.", "french": "Nous devons partir maintenant."}, {"english": "It might rain later.", "french": "Il pourrait pleuvoir plus tard."}],
                 "exceptions": ["Mustn't signifie interdiction ; don't have to signifie absence d'obligation.", "Can devient could pour une possibilité ou demande plus atténuée."]},
                {"id": "b1-conditionals", "title": "Conditionnels zéro et premier", "duration_minutes": 13,
                 "rule": "Le zéro conditionnel décrit une vérité générale (if + présent, présent). Le premier conditionnel décrit un résultat futur probable (if + présent, will + base verbale).", "examples": [{"english": "If you heat ice, it melts.", "french": "Si on chauffe la glace, elle fond."}, {"english": "If we hurry, we'll catch the train.", "french": "Si nous nous dépêchons, nous attraperons le train."}, {"english": "I'll call you if I have time.", "french": "Je t'appellerai si j'ai le temps."}],
                 "exceptions": ["N'utilisez généralement pas will dans la proposition introduite par if.", "La proposition en if peut être placée au début ou à la fin."]},
            ]},
            {"id": "sentence-building", "title": "Enrichir ses phrases", "topics": [
                {"id": "b1-relative-clauses", "title": "Propositions relatives", "duration_minutes": 12,
                 "rule": "Who introduit une personne, which une chose, that une personne ou une chose dans une relative déterminative. Where peut reprendre un lieu.",
                 "examples": [{"english": "The colleague who helped me is new.", "french": "Le collègue qui m'a aidé est nouveau."}, {"english": "The book that you lent me is excellent.", "french": "Le livre que tu m'as prêté est excellent."}, {"english": "This is the café where we met.", "french": "Voici le café où nous nous sommes rencontrés."}],
                 "exceptions": ["On peut omettre le pronom relatif quand il est complément : the book (that) I read.", "That ne remplace pas which dans une relative non déterminative entre virgules."]},
                {"id": "b1-passive", "title": "Voix passive : bases", "duration_minutes": 12,
                 "rule": "La voix passive se forme avec be conjugué + participe passé. Elle met en avant l'action ou son résultat plutôt que la personne qui agit.",
                 "examples": [{"english": "English is spoken here.", "french": "On parle anglais ici."}, {"english": "The bridge was built in 1890.", "french": "Le pont a été construit en 1890."}, {"english": "The email was sent by Maya.", "french": "Le courriel a été envoyé par Maya."}],
                 "exceptions": ["L'agent introduit par by est omis s'il est inconnu ou évident.", "Seuls les verbes avec complément direct se mettent habituellement au passif."]},
            ]},
        ],
    },
    "B2": {
        "title": "Précision et nuance",
        "description": "Maîtriser les formes complexes et adapter le degré de certitude.",
        "categories": [
            {"id": "advanced-tenses", "title": "Temps avancés", "topics": [
                {"id": "b2-past-perfect", "title": "Past perfect", "duration_minutes": 13,
                 "rule": "Had + participe passé marque une action antérieure à un autre moment passé. Il clarifie l'ordre des événements quand le contexte ne suffit pas.",
                 "examples": [{"english": "The train had left before we arrived.", "french": "Le train était parti avant notre arrivée."}, {"english": "She realized she had forgotten her keys.", "french": "Elle s'est rendu compte qu'elle avait oublié ses clés."}, {"english": "Had you met him before?", "french": "L'avais-tu déjà rencontré ?"}],
                 "exceptions": ["N'utilisez pas automatiquement le past perfect si l'ordre chronologique est déjà clair.", "After et before rendent parfois le past perfect facultatif."]},
                {"id": "b2-future-perfect", "title": "Futur perfect et futur continuous", "duration_minutes": 14,
                 "rule": "Will have + participe passé présente un résultat accompli avant une échéance future. Will be + -ing présente une action en cours à un moment futur.",
                 "examples": [{"english": "By Friday, I'll have finished the report.", "french": "D'ici vendredi, j'aurai terminé le rapport."}, {"english": "This time tomorrow, we'll be flying home.", "french": "Demain à la même heure, nous serons en train de rentrer en avion."}, {"english": "Will you be using the car tonight?", "french": "Utiliseras-tu la voiture ce soir ?"}],
                 "exceptions": ["By marque l'échéance attendue avec le futur perfect.", "Le futur continuous peut rendre une question plus neutre et moins intrusive."]},
            ]},
            {"id": "passive-and-reporting", "title": "Passif et discours rapporté", "topics": [
                {"id": "b2-passive-forms", "title": "Passif à plusieurs temps", "duration_minutes": 14,
                 "rule": "Conjuguez be au temps voulu puis ajoutez le participe passé : is being repaired, has been repaired, will be repaired.",
                 "examples": [{"english": "The road is being repaired.", "french": "La route est en cours de réparation."}, {"english": "All tickets have been sold.", "french": "Tous les billets ont été vendus."}, {"english": "The results will be announced tomorrow.", "french": "Les résultats seront annoncés demain."}],
                 "exceptions": ["Get + participe passé est plus informel et peut souligner un changement : get promoted.", "Certains verbes à deux compléments permettent deux constructions passives."]},
                {"id": "b2-reported-speech", "title": "Discours rapporté", "duration_minutes": 15,
                 "rule": "Après un verbe introducteur au passé, le temps recule souvent d'un cran. Les pronoms et repères de temps changent selon le point de vue.",
                 "examples": [{"english": "'I am busy.' → She said she was busy.", "french": "« Je suis occupée. » → Elle a dit qu'elle était occupée."}, {"english": "'We will call.' → They said they would call.", "french": "« Nous appellerons. » → Ils ont dit qu'ils appelleraient."}, {"english": "He told me to wait.", "french": "Il m'a dit d'attendre."}],
                 "exceptions": ["Le recul n'est pas nécessaire si l'information est toujours vraie.", "Say n'introduit pas directement un destinataire : tell me, mais say to me."]},
            ]},
            {"id": "hypothesis-and-emphasis", "title": "Hypothèse et emphase", "topics": [
                {"id": "b2-conditionals", "title": "Conditionnels deuxième et troisième", "duration_minutes": 14,
                 "rule": "Le deuxième conditionnel imagine une situation présente ou future peu probable (if + past, would + base). Le troisième imagine un passé différent (if + past perfect, would have + participe passé).", "examples": [{"english": "If I had more time, I'd travel.", "french": "Si j'avais plus de temps, je voyagerais."}, {"english": "If she had left earlier, she would have arrived on time.", "french": "Si elle était partie plus tôt, elle serait arrivée à l'heure."}, {"english": "I wish I had called you.", "french": "J'aurais aimé t'appeler."}],
                 "exceptions": ["Were est possible avec toutes les personnes dans une hypothèse formelle : If I were you.", "Would est généralement absent de la proposition en if."]},
                {"id": "b2-modals-deduction", "title": "Déduction et modalité passée", "duration_minutes": 13,
                 "rule": "Must exprime une forte déduction, might une possibilité et can't une impossibilité. Pour le passé, utilisez modal + have + participe passé.",
                 "examples": [{"english": "She must be at work.", "french": "Elle doit être au travail."}, {"english": "They might have missed the bus.", "french": "Ils ont peut-être raté le bus."}, {"english": "He can't have said that.", "french": "Il est impossible qu'il ait dit cela."}],
                 "exceptions": ["Must have exprime une déduction passée, pas une obligation passée.", "L'obligation passée se formule avec had to."]},
            ]},
        ],
    },
    "C1": {
        "title": "Maîtrise avancée",
        "description": "Choisir des structures idiomatiques et ajuster registre, focus et hypothèses.",
        "categories": [
            {"id": "complex-structures", "title": "Structures complexes", "topics": [
                {"id": "c1-inversion", "title": "Inversion après adverbes négatifs", "duration_minutes": 15,
                 "rule": "Pour insister dans un registre formel, un adverbe restrictif ou négatif placé en tête entraîne l'inversion auxiliaire-sujet : Never have I seen… Si aucun auxiliaire n'existe, utilisez do.",
                 "examples": [{"english": "Rarely do we see such dedication.", "french": "Il est rare que nous voyions un tel dévouement."}, {"english": "Not only did she apologize, but she also offered help.", "french": "Non seulement elle s'est excusée, mais elle a aussi proposé son aide."}, {"english": "Under no circumstances should you share this code.", "french": "En aucun cas vous ne devez partager ce code."}],
                 "exceptions": ["L'inversion est déclenchée par le groupe négatif placé en tête.", "Never I have seen est incorrect dans cette structure : l'auxiliaire précède le sujet."]},
                {"id": "c1-cleft-sentences", "title": "Cleft sentences et mise en relief", "duration_minutes": 13,
                 "rule": "It-cleft (It is X that…) et what-cleft (What… is X) isolent l'information mise en relief sans changer le fait de base.",
                 "examples": [{"english": "It was Lena who found the solution.", "french": "C'est Lena qui a trouvé la solution."}, {"english": "What we need is a clearer plan.", "french": "Ce dont nous avons besoin, c'est d'un plan plus clair."}, {"english": "It is the timing that worries me.", "french": "C'est le calendrier qui m'inquiète."}],
                 "exceptions": ["Who s'emploie pour une personne et that pour une chose dans la relative de l'it-cleft.", "La mise en relief porte sur un constituant, pas sur le temps du fait."]},
            ]},
            {"id": "modality-and-distance", "title": "Modalité et distance", "topics": [
                {"id": "c1-modal-perfect", "title": "Modal perfects et critique rétrospective", "duration_minutes": 14,
                 "rule": "Modal + have + participe passé exprime une lecture passée : should have pour un conseil non suivi, could have pour une possibilité, needn't have pour une action inutile.",
                 "examples": [{"english": "You should have told me.", "french": "Tu aurais dû me le dire."}, {"english": "They could have taken a taxi.", "french": "Ils auraient pu prendre un taxi."}, {"english": "We needn't have booked so early.", "french": "Nous n'avions pas besoin de réserver si tôt (mais nous l'avons fait)."}],
                 "exceptions": ["Didn't need to ne précise pas toujours si l'action a eu lieu ; needn't have implique qu'elle a eu lieu.", "Must have peut marquer une déduction et non un reproche."]},
                {"id": "c1-subjunctive", "title": "Subjonctif et registre formel", "duration_minutes": 12,
                 "rule": "Après certains verbes de recommandation ou nécessité, l'anglais formel utilise le subjonctif : sujet + base verbale, parfois avec should en anglais britannique.",
                 "examples": [{"english": "They recommended that he apply.", "french": "Ils ont recommandé qu'il postule."}, {"english": "It is essential that every member be present.", "french": "Il est essentiel que chaque membre soit présent."}, {"english": "She suggested that we should wait.", "french": "Elle a suggéré que nous attendions."}],
                 "exceptions": ["La forme be reste be à toutes les personnes dans le subjonctif présent.", "Cette construction est plus formelle que suggest + -ing."]},
            ]},
            {"id": "register-and-discourse", "title": "Registre et discours", "topics": [
                {"id": "c1-hedging", "title": "Atténuation et prudence", "duration_minutes": 11,
                 "rule": "Des tournures comme tend to, appear to, seem to et les modaux peuvent atténuer une affirmation et la rendre plus nuancée ou diplomatique.",
                 "examples": [{"english": "The figures appear to support this view.", "french": "Les chiffres semblent étayer ce point de vue."}, {"english": "This may suggest a broader issue.", "french": "Cela pourrait indiquer un problème plus large."}, {"english": "We tend to underestimate the cost.", "french": "Nous avons tendance à sous-estimer le coût."}],
                 "exceptions": ["L'atténuation doit refléter une incertitude réelle, pas brouiller une conclusion établie.", "Perhaps et arguably nuancent une proposition entière, avec des effets différents."]},
                {"id": "c1-participles", "title": "Participiales et réduction", "duration_minutes": 13,
                 "rule": "Une proposition participiale peut condenser une proposition subordonnée lorsque son sujet logique est clair et correspond généralement au sujet principal.",
                 "examples": [{"english": "Having completed the survey, we analysed the results.", "french": "Après avoir terminé l'enquête, nous avons analysé les résultats."}, {"english": "Designed for small spaces, the desk folds away.", "french": "Conçu pour les petits espaces, le bureau se replie."}, {"english": "Walking home, I noticed the new shop.", "french": "En rentrant à pied, j'ai remarqué la nouvelle boutique."}],
                 "exceptions": ["Évitez les participiales mal rattachées : leur sujet logique doit être identifiable.", "Having + participe passé marque une antériorité ; -ing simple est souvent simultané."]},
            ]},
        ],
    },
    "C2": {
        "title": "Nuance et maîtrise experte",
        "description": "Interpréter les nuances fines, manier l'emphase et choisir des constructions idiomatiques.",
        "categories": [
            {"id": "advanced-inversion", "title": "Inversion et emphase", "topics": [
                {"id": "c2-inversion-conditionals", "title": "Inversion dans les conditionnels", "duration_minutes": 14,
                 "rule": "Dans un registre soutenu, supprimez if et placez were, had ou should avant le sujet : Were I…, Had they…, Should you…",
                 "examples": [{"english": "Were the proposal to fail, we would reconsider.", "french": "Si la proposition échouait, nous réexaminerions la question."}, {"english": "Had I known, I would have acted sooner.", "french": "Si je l'avais su, j'aurais agi plus tôt."}, {"english": "Should you require assistance, contact us.", "french": "Si vous aviez besoin d'aide, contactez-nous."}],
                 "exceptions": ["L'inversion est formelle et souvent concise, surtout à l'écrit.", "Ne combinez pas if avec l'auxiliaire inversé : Had I known, pas If had I known."]},
                {"id": "c2-fronting", "title": "Fronting et structures emphatiques", "duration_minutes": 13,
                 "rule": "Le fronting place un élément connu ou contrasté en tête pour structurer l'information. L'inversion dépend de la construction, pas du fronting seul.",
                 "examples": [{"english": "That option, I would rule out immediately.", "french": "Cette option, je l'écarterais immédiatement."}, {"english": "Much as I admire her work, I disagree.", "french": "Même si j'admire beaucoup son travail, je ne suis pas d'accord."}, {"english": "Try as he might, he couldn't persuade them.", "french": "Il avait beau essayer, il ne pouvait pas les convaincre."}],
                 "exceptions": ["Le fronting peut sembler théâtral s'il est trop fréquent.", "Certaines formes figées comme Try as he might relèvent d'une syntaxe idiomatique."]},
            ]},
            {"id": "meaning-and-aspect", "title": "Sens fin et aspect", "topics": [
                {"id": "c2-subjunctive-were", "title": "Hypothèse, irréel et wish", "duration_minutes": 13,
                 "rule": "Le past subjunctive (were) marque une distance irréelle ou hypothétique. Wish + past exprime un regret présent ; wish + past perfect, un regret passé.",
                 "examples": [{"english": "I wish I were more patient.", "french": "J'aimerais être plus patient."}, {"english": "She wishes she had accepted the offer.", "french": "Elle regrette d'avoir accepté l'offre."}, {"english": "If only we had checked the figures.", "french": "Si seulement nous avions vérifié les chiffres."}],
                 "exceptions": ["Was est fréquent à l'oral informel avec I/he/she, mais were reste standard dans l'irréel soutenu.", "Wish + would exprime souvent une volonté de changement ou une irritation."]},
                {"id": "c2-verb-patterns", "title": "Constructions verbales et changement de sens", "duration_minutes": 15,
                 "rule": "Certains verbes changent de sens selon qu'ils sont suivis de -ing ou de to + infinitif : remember doing évoque un souvenir, remember to do une tâche à accomplir.",
                 "examples": [{"english": "I regret saying that.", "french": "Je regrette d'avoir dit cela."}, {"english": "We regret to inform you of a delay.", "french": "Nous avons le regret de vous informer d'un retard."}, {"english": "She stopped to answer the call.", "french": "Elle s'est arrêtée pour répondre à l'appel."}],
                 "exceptions": ["Stop doing signifie cesser l'activité ; stop to do signifie s'interrompre afin de faire autre chose.", "La construction dépend du sens lexical et doit souvent s'apprendre avec le verbe."]},
            ]},
            {"id": "style-and-cohesion", "title": "Style et cohésion", "topics": [
                {"id": "c2-concession", "title": "Concession et contraste élaborés", "duration_minutes": 12,
                 "rule": "Concessifs comme although, whereas, much as et however organisent des contrastes. Choisissez la structure selon que vous reliez des propositions ou des groupes nominaux.",
                 "examples": [{"english": "Much as I value speed, accuracy matters more.", "french": "Même si la rapidité compte, la précision importe davantage."}, {"english": "The plan is ambitious; nevertheless, it is feasible.", "french": "Le plan est ambitieux ; néanmoins, il est réalisable."}, {"english": "Whereas costs rose, demand remained stable.", "french": "Alors que les coûts augmentaient, la demande est restée stable."}],
                 "exceptions": ["Despite/in spite of sont suivis d'un nom ou d'un gérondif, pas directement d'une proposition complète.", "However peut être un adverbe de liaison et ne remplace pas toujours but."]},
                {"id": "c2-ellipsis-substitution", "title": "Ellipse et substitution", "duration_minutes": 12,
                 "rule": "So, neither, one/ones et do so évitent les répétitions en reprenant une idée déjà présente. L'auxiliaire de reprise dépend de la structure précédente.",
                 "examples": [{"english": "She can drive, and so can I.", "french": "Elle sait conduire, moi aussi."}, {"english": "I prefer the blue ones.", "french": "Je préfère les bleus."}, {"english": "He promised to reply and did so promptly.", "french": "Il a promis de répondre et l'a fait rapidement."}],
                 "exceptions": ["Neither + auxiliaire + sujet marque l'accord avec une proposition négative.", "One/ones remplace un nom dénombrable ; il ne remplace pas normalement un nom indénombrable."]},
            ]},
        ],
    },
}


def _lesson(
    topic_id: str,
    title: str,
    formula: str,
    explanation: str,
    examples: list[tuple[str, str]],
    exceptions: list[str],
    duration: int = 12,
) -> dict:
    return {
        "id": topic_id,
        "title": title,
        "duration_minutes": duration,
        "formula": formula,
        "rule": explanation,
        "examples": [{"english": english, "french": french} for english, french in examples],
        "exceptions": exceptions,
    }


EXTENDED_CATEGORIES = {
    "A1": [
        {"id": "a1-people-and-possession", "title": "Personnes et possession", "topics": [
            _lesson("a1-pronouns", "Pronoms sujets et compléments", "Sujet : I / you / he / she / it / we / they | Complément : me / you / him / her / it / us / them", "Le pronom sujet fait l'action et précède le verbe. Le pronom complément reçoit l'action ou suit une préposition. En anglais, le sujet est normalement exprimé.", [("She knows him.", "Elle le connaît."), ("They invited us.", "Ils nous ont invités."), ("I spoke to her.", "Je lui ai parlé.")], ["It désigne aussi les animaux ou les objets et sert de sujet impersonnel : It's late.", "You peut être singulier ou pluriel."]),
            _lesson("a1-possessives", "Adjectifs et pronoms possessifs", "Adjectif + nom : my book | Pronom seul : mine", "Les adjectifs possessifs précèdent un nom ; les pronoms possessifs le remplacent. La forme dépend du possesseur, pas du genre du nom possédé.", [("This is my bag.", "C'est mon sac."), ("That seat is yours.", "Cette place est la vôtre."), ("Their house is bigger than ours.", "Leur maison est plus grande que la nôtre.")], ["His peut être adjectif ou pronom ; hers et ours ne prennent jamais d'apostrophe.", "Les possessifs anglais ne s'accordent pas avec l'objet possédé."]),
            _lesson("a1-have-got", "Have et have got", "Sujet + have/has (got) + complément | Question : Have/Has + sujet + (got) ?", "Have exprime notamment la possession, les relations et certaines caractéristiques. Have got a le même sens de possession, surtout en anglais britannique courant.", [("I have a younger brother.", "J'ai un petit frère."), ("She's got blue eyes.", "Elle a les yeux bleus."), ("Have you got a minute?", "As-tu une minute ?")], ["On dit do you have ? mais have you got ? ; ne mélangez pas do et got.", "Have got est rarement utilisé pour les routines : I have breakfast at seven."]),
            _lesson("a1-genitive", "Génitif en 's et of", "Possesseur animé + 's + nom | chose + of + nom (souvent)", "Le génitif en 's relie souvent une personne, un animal ou une organisation à ce qui lui appartient. Of est courant pour les relations entre objets ou les formulations descriptives.", [("Maya's phone is new.", "Le téléphone de Maya est neuf."), ("My parents' car is outside.", "La voiture de mes parents est dehors."), ("The name of the street is unusual.", "Le nom de la rue est inhabituel.")], ["Le pluriel régulier en -s prend seulement l'apostrophe : my friends' house.", "Les expressions de temps prennent souvent 's : today's lesson."]),
        ]},
        {"id": "a1-sentences-and-actions", "title": "Phrases et actions", "topics": [
            _lesson("a1-there-be", "There is et there are", "There is + singulier/indénombrable | There are + pluriel", "There is/are introduit l'existence ou la présence de quelque chose. Choisissez is ou are selon le nom qui suit.", [("There is a pharmacy near here.", "Il y a une pharmacie près d'ici."), ("There are two windows in the room.", "Il y a deux fenêtres dans la pièce."), ("Is there any milk left?", "Est-ce qu'il reste du lait ?")], ["À l'oral, there's s'emploie parfois avec un pluriel, mais there are reste la forme standard.", "La négation est there isn't/aren't ; les questions inversent be et there."]),
            _lesson("a1-question-word-order", "Ordre des questions et auxiliaires", "Question oui/non : auxiliaire + sujet + verbe ? | Wh- : mot interrogatif + auxiliaire + sujet + verbe ?", "Les questions anglaises placent généralement l'auxiliaire avant le sujet. Au present simple et au past simple, do/does/did porte la question ; be et les modaux s'inversent directement.", [("Do you know the answer?", "Connais-tu la réponse ?"), ("Where does the bus stop?", "Où le bus s'arrête-t-il ?"), ("Can we sit here?", "Pouvons-nous nous asseoir ici ?")], ["Lorsque who/what est le sujet, ne rajoutez pas do : Who called?", "Les questions indirectes gardent l'ordre déclaratif : Do you know where she lives?"]),
            _lesson("a1-present-continuous", "Present continuous", "Sujet + am/is/are + verbe en -ing", "Utilisez le present continuous pour une action en cours, une situation temporaire ou un changement observé autour du moment présent.", [("I'm waiting for the bus.", "J'attends le bus."), ("She's staying with her aunt this week.", "Elle loge chez sa tante cette semaine."), ("The weather is getting warmer.", "Le temps se réchauffe.")], ["Les verbes d'état (know, want, belong) prennent rarement -ing.", "Supprimez le e final (write → writing) ; certains verbes doublent leur consonne (run → running)."]),
            _lesson("a1-can-ability", "Can : capacité et permission", "Sujet + can + base verbale | Question : Can + sujet + base ?", "Can exprime une capacité, une possibilité concrète ou une permission informelle. Il ne varie pas selon la personne et est suivi directement de la base verbale.", [("My sister can swim.", "Ma sœur sait nager."), ("Can I open the window?", "Puis-je ouvrir la fenêtre ?"), ("We can't park here.", "Nous ne pouvons pas nous garer ici.")], ["Après can, pas de to ni de -s : he can drive.", "La forme passée de capacité générale est could ; be able to permet d'autres temps."]),
            _lesson("a1-imperatives", "Impératif et let's", "Base verbale (+ complément) | Don't + base | Let's + base", "L'impératif donne une instruction, une consigne ou un conseil direct. Let's propose une action partagée ; please adoucit une demande.", [("Turn left at the traffic lights.", "Tournez à gauche au feu."), ("Don't touch the wet paint.", "Ne touchez pas la peinture fraîche."), ("Let's take a break.", "Faisons une pause.")], ["Le sujet you est normalement omis.", "Pour une interdiction, don't précède la base même avec be : Don't be late."]),
            _lesson("a1-frequency-adverbs", "Adverbes de fréquence", "Sujet + adverbe + verbe principal | be + adverbe", "Always, usually, often, sometimes et never précisent la fréquence. Ils se placent généralement avant le verbe principal mais après be.", [("I usually walk to work.", "Je vais généralement au travail à pied."), ("She is often busy on Mondays.", "Elle est souvent occupée le lundi."), ("They never eat meat.", "Ils ne mangent jamais de viande.")], ["Never a déjà un sens négatif : n'ajoutez pas don't.", "Sometimes peut aussi être placé en début ou fin de phrase."]),
            _lesson("a1-countable-uncountable", "Noms dénombrables et indénombrables", "a/an + nom dénombrable singulier | some + pluriel/indénombrable", "Un nom dénombrable se compte et possède un pluriel. Un indénombrable désigne une matière, une notion ou un ensemble et ne prend généralement pas a/an ni de pluriel.", [("We need a chair and some furniture.", "Il nous faut une chaise et des meubles."), ("There are some apples on the table.", "Il y a des pommes sur la table."), ("Can I have some information?", "Puis-je avoir des renseignements ?")], ["Furniture, advice, information et luggage sont indénombrables en anglais.", "Utilisez a piece of pour compter certains indénombrables : a piece of advice."]),
        ]},
        {"id": "a1-wh-question-words", "title": "Mots interrogatifs Wh-", "topics": [
            _lesson("a1-wh-who", "Who : personne sujet ou complément", "Who + verbe ? (sujet) | Wh-word + do/does + sujet + verbe ? (complément)", "Who demande l'identité d'une personne. Lorsqu'il est sujet, il est directement suivi du verbe ; lorsqu'il est complément, la question reprend généralement l'ordre avec auxiliaire.", [("Who called while I was out?", "Qui a appelé pendant mon absence ?"), ("Who do you usually sit with?", "Avec qui t'assieds-tu d'habitude ?"), ("Who is responsible for this room?", "Qui est responsable de cette salle ?")], ["Who est courant comme complément à l'oral même là où whom serait formel.", "Avec be, l'inversion se fait entre be et le sujet : Who is she?"]),
            _lesson("a1-wh-whom", "Whom : complément formel", "Whom + auxiliaire + sujet + verbe ? | préposition + whom (formel)", "Whom identifie une personne qui reçoit l'action ou suit une préposition. Son emploi est surtout formel ; l'anglais courant préfère souvent who et place la préposition en fin de question.", [("Whom did the committee invite?", "Qui le comité a-t-il invité ?"), ("To whom should I address the letter?", "À qui dois-je adresser la lettre ?"), ("Who should I address the letter to?", "À qui dois-je adresser la lettre ?")], ["Whom ne remplace jamais le sujet : Who called?", "La préposition initiale donne un registre formel ; son placement final est naturel à l'oral."]),
            _lesson("a1-wh-whose", "Whose : possession et propriétaire", "Whose + nom + auxiliaire + sujet + verbe ? | Whose + be + sujet ?", "Whose demande à qui appartient une chose. Il peut déterminer un nom ou être utilisé seul ; la réponse emploie souvent un possessif en 's ou un pronom possessif.", [("Whose keys are these?", "À qui sont ces clés ?"), ("Whose is the blue coat?", "À qui est le manteau bleu ?"), ("Whose idea was it to change the plan?", "À qui était l'idée de changer le plan ?")], ["Whose exprime la possession ; who's est la contraction de who is ou who has.", "Ne confondez pas whose avec which person's, plus lourd et généralement inutile."]),
            _lesson("a1-wh-what", "What : identité, information et activité", "What + nom + auxiliaire + sujet + verbe ? | What + verbe ? (sujet)", "What demande une information ouverte sur une chose, une identité, une activité ou une catégorie. Il peut aussi être lui-même sujet et se placer alors directement devant le verbe.", [("What do you do at weekends?", "Que fais-tu le week-end ?"), ("What happened to the lights?", "Qu'est-il arrivé aux lumières ?"), ("What size do you need?", "Quelle taille vous faut-il ?")], ["What + nom (what time/colour/size) précise le type d'information demandé.", "What est fréquent pour un choix ouvert ; which suppose plus souvent un ensemble délimité."]),
            _lesson("a1-wh-which", "Which : choix parmi un ensemble", "Which + nom/pronom + auxiliaire + sujet + verbe ?", "Which demande de choisir ou d'identifier un élément dans un ensemble connu, visible ou limité. Il peut précéder un nom ou être utilisé seul.", [("Which bus goes to the museum?", "Quel bus va au musée ?"), ("Which of these seats is free?", "Lequel de ces sièges est libre ?"), ("Which would you prefer, tea or coffee?", "Que préfères-tu, du thé ou du café ?")], ["Which porte sur un ensemble délimité ; what peut laisser le choix ouvert.", "Which of est suivi d'un déterminant ou pronom : which of them, pas which of people."]),
            _lesson("a1-wh-where", "Where : lieu et destination", "Where + auxiliaire/be + sujet + verbe ? | Where + sujet + verbe ? (sujet)", "Where demande un lieu, une origine ou une destination. Une préposition de lieu ou de mouvement peut rester à la fin de la question.", [("Where does the path lead?", "Où mène le sentier ?"), ("Where are you from?", "D'où viens-tu ?"), ("Where did you put the spare key?", "Où as-tu mis le double des clés ?")], ["Where to ? existe à l'oral pour demander une destination ; where are you going ? est la forme neutre.", "Where ne signifie pas automatiquement vers où : le verbe et le contexte portent la direction."]),
            _lesson("a1-wh-when", "When et what time : moment et horaire", "When + auxiliaire + sujet + verbe ? | What time + auxiliaire + sujet + verbe ?", "When demande un moment, une date ou une période ; what time demande généralement une heure précise. Les réponses peuvent comporter une préposition temporelle.", [("When does the course begin?", "Quand le cours commence-t-il ?"), ("What time should we meet?", "À quelle heure devons-nous nous retrouver ?"), ("When did you last see her?", "Quand l'as-tu vue pour la dernière fois ?")], ["On dit at what time pour insister sur l'heure exacte, mais what time suffit généralement.", "Since when demande un point de départ et peut exprimer la surprise."]),
            _lesson("a1-wh-why", "Why : cause, motif et but", "Why + auxiliaire + sujet + verbe ? | réponse : because + proposition", "Why demande la raison ou le motif. La réponse commence souvent par because ; une réponse avec to + infinitif exprime le but d'une action.", [("Why is the shop closed? Because it's a holiday.", "Pourquoi le magasin est-il fermé ? Parce que c'est un jour férié."), ("Why did you call? To confirm the booking.", "Pourquoi as-tu appelé ? Pour confirmer la réservation."), ("Why not take the earlier train?", "Pourquoi ne pas prendre le train précédent ?")], ["Because est suivi d'une proposition ; because of d'un nom ou d'un groupe nominal.", "Why not + base est une suggestion, pas nécessairement une vraie question causale."]),
            _lesson("a1-wh-how", "How : manière, état et moyen", "How + auxiliaire/be + sujet + verbe ? | How + adjectif/adverbe ?", "How demande de quelle manière une action se déroule ou dans quel état se trouve une personne ou une chose. Il entre aussi dans des expressions de mesure.", [("How do you spell your surname?", "Comment épelles-tu ton nom ?"), ("How are you feeling today?", "Comment te sens-tu aujourd'hui ?"), ("How did they get here?", "Comment sont-ils arrivés ici ?")], ["How est suivi de l'auxiliaire puis du sujet dans une question ordinaire.", "How come est une variante familière qui garde l'ordre déclaratif : How come you're late?"]),
            _lesson("a1-wh-how-much", "How much : quantité indénombrable et prix", "How much + nom indénombrable + auxiliaire + sujet + verbe ?", "How much demande une quantité d'un nom indénombrable ou le prix. Le nom qui suit reste au singulier grammatical lorsqu'il est exprimé.", [("How much water should I add?", "Combien d'eau dois-je ajouter ?"), ("How much is this jacket?", "Combien coûte cette veste ?"), ("How much time do we have left?", "Combien de temps nous reste-t-il ?")], ["Pour des unités dénombrables, utilisez how many.", "How much? seul peut demander un prix, avec une monnaie sous-entendue."]),
            _lesson("a1-wh-how-many", "How many : nombre dénombrable", "How many + nom pluriel + auxiliaire + sujet + verbe ?", "How many demande un nombre d'éléments dénombrables. Le nom se met au pluriel, y compris lorsque la réponse attendue est one.", [("How many languages does she speak?", "Combien de langues parle-t-elle ?"), ("How many eggs do we need?", "Combien d'œufs nous faut-il ?"), ("How many of your friends are coming?", "Combien de tes amis viennent ?")], ["How many of est suivi d'un déterminant ou d'un pronom défini.", "N'utilisez pas how much avec un pluriel dénombrable."]),
            _lesson("a1-wh-how-long", "How long : durée et longueur", "How long + auxiliaire + sujet + verbe ?", "How long demande une durée ou la longueur physique d'un objet ou d'un trajet. Le contexte et l'unité de réponse distinguent ces deux interprétations.", [("How long does the film last?", "Combien de temps dure le film ?"), ("How long have you lived here?", "Depuis combien de temps habites-tu ici ?"), ("How long is the bridge?", "Quelle est la longueur du pont ?")], ["Pour une durée jusqu'au présent, le present perfect est fréquent avec how long.", "How long ago demande le temps écoulé depuis un événement passé terminé."]),
            _lesson("a1-wh-how-often", "How often : fréquence", "How often + auxiliaire + sujet + verbe ?", "How often demande la fréquence d'une action. La réponse utilise un adverbe de fréquence, une périodicité ou une expression comme once a week.", [("How often do you visit your grandparents?", "À quelle fréquence rends-tu visite à tes grands-parents ?"), ("How often does this bus run?", "À quelle fréquence ce bus passe-t-il ?"), ("How often have you been there this year?", "Combien de fois y es-tu allé cette année ?")], ["How many times demande un décompte ; how often vise plutôt la régularité.", "Placez usually/often avant le verbe principal, mais après be."]),
            _lesson("a1-wh-how-far", "How far : distance et éloignement", "How far + be/auxiliaire + sujet + (from/to) + lieu ?", "How far mesure une distance ou demande si un lieu est éloigné. La réponse peut donner une unité, un temps de trajet ou une estimation.", [("How far is the station from here?", "À quelle distance se trouve la gare d'ici ?"), ("How far did you walk?", "Quelle distance as-tu parcourue à pied ?"), ("How far are we from the coast?", "À quelle distance sommes-nous de la côte ?")], ["How long demande une durée ou une longueur ; how far une distance.", "How far can also express degree in expressions such as how far the plan has progressed."]),
        ]},
        {"id": "a1-prepositions-place", "title": "Prépositions de lieu et de position", "topics": [
            _lesson("a1-prep-in-on-at-place", "In, on et at : position", "in + espace/conteneur | on + surface/ligne | at + point/adresse", "In présente un espace contenant ou délimité, on une surface ou ligne de contact, at un point repéré ou une adresse. Le choix dépend de la façon dont le locuteur conceptualise le lieu.", [("The keys are in the drawer.", "Les clés sont dans le tiroir."), ("There's a note on the fridge.", "Il y a un mot sur le réfrigérateur."), ("Meet me at the entrance.", "Retrouve-moi à l'entrée.")], ["On the bus/train, mais in a car/taxi dans l'usage courant.", "At home, at work et at school sont des expressions établies."]),
            _lesson("a1-prep-under-below", "Under, underneath, below et beneath", "under/underneath : position inférieure (souvent proche) | below/beneath : niveau inférieur", "Ces prépositions situent quelque chose plus bas qu'un repère. Under implique souvent une relation spatiale directe ou une couverture ; below compare des niveaux ou des mesures.", [("The cat is under the table.", "Le chat est sous la table."), ("The village lies below the mountain.", "Le village se trouve en contrebas de la montagne."), ("The temperature fell beneath zero.", "La température est passée sous zéro.")], ["Under peut exprimer une limite ou un contrôle : under 18, under pressure.", "Beneath est plus formel ou littéraire que under."]),
            _lesson("a1-prep-over-above", "Over et above", "above : niveau supérieur sans contact | over : au-dessus, couverture ou franchissement", "Above compare des hauteurs ou positions. Over peut indiquer une couverture, une position de l'autre côté, un mouvement par-dessus ou un dépassement quantitatif.", [("The picture hangs above the sofa.", "Le tableau est accroché au-dessus du canapé."), ("A plane flew over the city.", "Un avion a survolé la ville."), ("Put a cover over the food.", "Mets un couvercle sur la nourriture.")], ["Over peut signifier more than avec un nombre : over 100 people.", "Across over implique le franchissement d'un espace ; above n'exprime pas ce mouvement."]),
            _lesson("a1-prep-between-among", "Between et among", "between + éléments individualisés | among + groupe ou ensemble", "Between relie généralement des éléments distincts, même s'ils sont plus de deux. Among situe quelque chose à l'intérieur d'un groupe considéré collectivement.", [("The café is between the bank and the library.", "Le café est entre la banque et la bibliothèque."), ("She felt comfortable among friends.", "Elle se sentait à l'aise parmi ses amis."), ("The agreement was reached between five countries.", "L'accord a été conclu entre cinq pays.")], ["Between n'est pas limité à deux éléments si chacun est identifié.", "Among est rarement suivi d'une liste d'éléments individualisés."]),
            _lesson("a1-prep-near-beside-by", "Near, next to, beside et by", "near : proximité | next to/beside : immédiatement à côté | by : proximité/contact", "Ces prépositions expriment différents degrés de proximité. Next to et beside placent deux éléments côte à côte ; near donne une proximité moins précise.", [("The hotel is near the station.", "L'hôtel est près de la gare."), ("Sit next to your sister.", "Assieds-toi à côté de ta sœur."), ("There's a small table by the bed.", "Il y a une petite table près du lit.")], ["Beside signifie à côté de ; besides signifie en plus de.", "By peut aussi exprimer l'agent, le moyen ou une échéance selon le contexte."]),
            _lesson("a1-prep-front-behind-opposite", "In front of, behind et opposite", "in front of : devant | behind : derrière | opposite : en face", "Ces groupes prépositionnels décrivent la position relative à un repère. Opposite indique généralement une orientation face à face, souvent de l'autre côté d'un espace.", [("The bus stop is in front of the museum.", "L'arrêt de bus est devant le musée."), ("The garden is behind the house.", "Le jardin est derrière la maison."), ("The pharmacy is opposite the school.", "La pharmacie est en face de l'école.")], ["In front of indique une position, ahead of peut indiquer l'ordre ou l'avance.", "Across from est une variante courante d'opposite, particulièrement en anglais américain."]),
            _lesson("a1-prep-inside-outside", "Inside, outside et within", "inside/outside + nom | within + limite ou périmètre", "Inside et outside situent à l'intérieur ou à l'extérieur d'un espace. Within marque souvent une limite spatiale ou abstraite et appartient à un registre plus formel.", [("Please wait inside the building.", "Veuillez attendre à l'intérieur du bâtiment."), ("The children are playing outside.", "Les enfants jouent dehors."), ("The village is within walking distance.", "Le village se trouve à distance de marche.")], ["Inside peut être adverbe sans nom ; outside peut être suivi de of selon la construction.", "Within signifie aussi dans un délai ou une organisation : within two days."]),
        ]},
        {"id": "a1-prepositions-time-motion", "title": "Prépositions de temps et mouvement", "topics": [
            _lesson("a1-prep-in-on-at-time", "In, on et at : repères temporels", "in + période | on + jour/date | at + heure/moment ponctuel", "In accompagne des périodes larges, on les jours et dates, at les heures et moments ponctuels. Les expressions temporelles suivent des conventions qu'il faut apprendre avec les noms concernés.", [("We moved here in 2021.", "Nous avons emménagé ici en 2021."), ("The appointment is on Thursday.", "Le rendez-vous est jeudi."), ("The shop closes at 6 p.m.", "Le magasin ferme à 18 heures.")], ["Pas de préposition devant last/next/every/this : next week.", "On dit at night mais in the morning/afternoon/evening."]),
            _lesson("a1-prep-since-for-during", "Since, for, during et while", "since + point de départ | for + durée | during + nom | while + sujet + verbe", "Since situe le début d'une période, for sa durée. During précède un nom d'événement ou de période ; while introduit une proposition avec un verbe.", [("I've worked here for two years.", "Je travaille ici depuis deux ans."), ("She's been away since Monday.", "Elle est absente depuis lundi."), ("Please stay seated during the flight.", "Veuillez rester assis pendant le vol.")], ["Since s'emploie souvent avec le present perfect pour une situation encore vraie.", "While + -ing est possible lorsque le sujet logique est clair : while travelling."]),
            _lesson("a1-prep-by-until", "By, until et till", "by + échéance (au plus tard) | until/till + durée qui se prolonge jusqu'à", "By fixe une limite avant laquelle un résultat doit être atteint. Until/till indique qu'une situation continue et s'arrête à un moment donné.", [("Please send the form by Friday.", "Veuillez envoyer le formulaire d'ici vendredi au plus tard."), ("The museum is open until six.", "Le musée est ouvert jusqu'à six heures."), ("I'll wait till you get back.", "J'attendrai jusqu'à ton retour.")], ["By Friday n'indique pas que l'action se poursuit vendredi ; until Friday, oui.", "Till est courant à l'oral ; until convient à tous les registres."]),
            _lesson("a1-prep-to-into-onto", "To, into et onto : destination et entrée", "to + destination | into + mouvement vers l'intérieur | onto + mouvement vers une surface", "To indique le point d'arrivée. Into insiste sur le passage vers l'intérieur d'un espace ; onto sur le mouvement jusqu'au contact d'une surface.", [("We drove to the airport.", "Nous sommes allés à l'aéroport en voiture."), ("She walked into the room.", "Elle est entrée dans la pièce."), ("The cat jumped onto the counter.", "Le chat a sauté sur le plan de travail.")], ["In/on situent sans mouvement ; into/onto décrivent généralement un changement de position.", "On emploie aussi in avec certains verbes de mouvement lexicalisés : walk in."]),
            _lesson("a1-prep-out-of-off-from", "Out of, off et from : sortie et origine", "out of + intérieur vers extérieur | off + surface | from + origine", "Out of indique une sortie d'un espace, off un détachement ou mouvement depuis une surface, from l'origine d'un trajet ou d'une relation.", [("He came out of the office.", "Il est sorti du bureau."), ("Take your shoes off the chair.", "Enlève tes chaussures de la chaise."), ("This train comes from Oxford.", "Ce train vient d'Oxford.")], ["Off s'oppose souvent à on ; out of à into.", "From peut introduire une origine temporelle dans from Monday to Friday."]),
            _lesson("a1-prep-through-across", "Through et across", "through + intérieur/traversée d'un volume | across + traversée d'une surface", "Through décrit un trajet à l'intérieur d'un espace ou d'un passage. Across décrit le franchissement d'une surface, d'une étendue ou d'un côté à l'autre.", [("We walked through the forest.", "Nous avons marché dans la forêt."), ("She ran across the road.", "Elle a traversé la route en courant."), ("Light came through the window.", "La lumière est passée par la fenêtre.")], ["Across from signifie en face de dans certaines variétés d'anglais.", "Through peut aussi exprimer un moyen ou une période entière : through hard work, Monday through Friday (AmE)."]),
            _lesson("a1-prep-along-past-towards", "Along, past et towards", "along + direction suivant un axe | past + au-delà d'un repère | towards + en direction de", "Ces prépositions décrivent la trajectoire plutôt que la destination finale. Along suit une ligne, past dépasse un point et towards exprime une direction sans garantir l'arrivée.", [("They cycled along the river.", "Ils ont longé la rivière à vélo."), ("Go past the post office and turn left.", "Passe devant la poste puis tourne à gauche."), ("The dog ran towards its owner.", "Le chien a couru vers son maître.")], ["Toward est la variante américaine courante de towards.", "Past est une préposition de mouvement ; passed est le prétérit du verbe pass."]),
        ]},
        {"id": "a1-prepositions-relations", "title": "Agent, bénéficiaire, accompagnement et moyen", "topics": [
            _lesson("a1-prep-by", "By : agent, moyen, proximité et échéance", "by + agent (passif) | by + moyen/procédé | by + date limite", "By identifie l'agent d'un passif, le moyen utilisé ou la limite au plus tard. Dans une expression de lieu, by signifie près de ou à côté de.", [("The novel was written by Orwell.", "Le roman a été écrit par Orwell."), ("We travelled by train.", "Nous avons voyagé en train."), ("Please reply by Monday.", "Merci de répondre au plus tard lundi.")], ["On dit on foot, mais by car/by train.", "By Monday fixe une échéance ; until Monday indique une durée qui se poursuit jusque-là."]),
            _lesson("a1-prep-for", "For : bénéficiaire, but, durée et échange", "for + bénéficiaire/but/durée | for + prix/échange", "For relie une action à son destinataire, son objectif, sa durée ou sa contrepartie. Le sens vient du type de complément et du verbe associé.", [("I bought these flowers for my neighbour.", "J'ai acheté ces fleurs pour mon voisin."), ("We've been waiting for an hour.", "Nous attendons depuis une heure."), ("She exchanged the book for a map.", "Elle a échangé le livre contre une carte.")], ["For + durée répond à how long ; since + point de départ répond à since when.", "Pour exprimer le but d'une action, to + infinitif est souvent préférable à for + infinitif."]),
            _lesson("a1-prep-with", "With : accompagnement, instrument et caractéristique", "with + personne/outil/caractéristique | without + absence", "With indique la présence d'une personne, l'instrument utilisé ou une caractéristique associée. Without marque l'absence ; les deux prépositions peuvent précéder un nom, un pronom ou un gérondif.", [("She came with her younger brother.", "Elle est venue avec son petit frère."), ("Open the package with scissors.", "Ouvre le paquet avec des ciseaux."), ("He answered with a smile.", "Il a répondu avec un sourire.")], ["Avec les parties du corps, l'anglais emploie souvent l'article défini : hit him on the arm.", "With peut exprimer l'opposition : I agree with you, mais I'm angry with him."]),
        ]},
    ],
    "A2": [
        {"id": "a2-present-and-future", "title": "Présent et futur en contexte", "topics": [
            _lesson("a2-present-simple-continuous", "Present simple ou continuous", "Habitude/fait : present simple | action temporaire/en cours : be + -ing", "Le present simple décrit une habitude, un état ou un fait stable. Le present continuous décrit une activité temporaire, en cours ou une évolution.", [("He works in a bank, but he's working from home today.", "Il travaille dans une banque, mais il travaille de chez lui aujourd'hui."), ("I don't understand this question.", "Je ne comprends pas cette question."), ("More people are using electric bikes.", "De plus en plus de personnes utilisent des vélos électriques.")], ["Les verbes d'état comme understand et belong s'emploient rarement au continu.", "Always + continuous peut exprimer une irritation : He's always losing his keys."]),
            _lesson("a2-present-continuous-future", "Présent continu pour un arrangement futur", "Sujet + am/is/are + verbe en -ing + repère futur", "Le present continuous présente un arrangement déjà organisé, souvent avec une heure, une date ou un lieu convenu.", [("We're meeting Sam at six.", "Nous retrouvons Sam à six heures."), ("She's flying to Rome on Friday.", "Elle part pour Rome vendredi."), ("What are you doing this weekend?", "Qu'est-ce que tu fais ce week-end ?")], ["Pour une intention sans arrangement précis, going to est souvent plus approprié.", "Le repère futur est souvent explicite ou compris dans le contexte."]),
            _lesson("a2-past-questions-negatives", "Questions et négations au past simple", "Did + sujet + base verbale ? | Sujet + didn't + base verbale", "Did porte le temps passé dans les questions et négations ; le verbe principal reprend sa forme de base, y compris les verbes irréguliers.", [("Did you call your mother?", "As-tu appelé ta mère ?"), ("He didn't see the sign.", "Il n'a pas vu le panneau."), ("Where did they stay?", "Où ont-ils séjourné ?")], ["Be n'utilise pas did : Were you tired ? / She wasn't ready.", "Le verbe après did ne garde jamais la marque du prétérit."]),
            _lesson("a2-articles-zero", "Articles définis, indéfinis et absence d'article", "a/an : un élément nouveau | the : identifié | Ø : généralités/pluriels", "A/an introduit un nom dénombrable singulier non identifié. The renvoie à un élément identifiable ; l'article zéro s'utilise notamment pour les généralités au pluriel et les noms indénombrables.", [("I saw a dog. The dog was carrying a ball.", "J'ai vu un chien. Le chien portait une balle."), ("Books can change your life.", "Les livres peuvent changer votre vie."), ("Water is essential.", "L'eau est essentielle.")], ["The est utilisé avec un nom rendu unique par le contexte ou un complément.", "Les repas, langues et matières scolaires s'emploient souvent sans article : have breakfast, speak English."]),
            _lesson("a2-going-to-evidence", "Going to : intentions et indices visibles", "Sujet + am/is/are + going to + base verbale", "Going to sert à annoncer une intention déjà formée ou une prédiction appuyée sur un indice observable au moment où l'on parle.", [("I've bought the paint; I'm going to redecorate.", "J'ai acheté la peinture ; je vais redécorer."), ("Look at those clouds. It's going to rain.", "Regarde ces nuages. Il va pleuvoir."), ("Are they going to join us?", "Vont-ils nous rejoindre ?")], ["Will est plus courant pour une décision prise sur le moment.", "Dans une proposition après when/if, le présent remplace généralement going to/will."]),
        ]},
        {"id": "a2-meaning-and-patterns", "title": "Quantité, degré et constructions", "topics": [
            _lesson("a2-adverbs-manner", "Adverbes de manière", "verbe + adverbe en -ly | be/seem + adjectif", "Les adverbes de manière décrivent comment une action est réalisée. Beaucoup se forment avec adjectif + -ly, mais ils ne remplacent pas un adjectif après un verbe d'état.", [("She speaks clearly.", "Elle parle clairement."), ("The children are quiet.", "Les enfants sont calmes."), ("He drives well.", "Il conduit bien.")], ["Good est l'adjectif ; well est généralement l'adverbe.", "Fast, hard et late peuvent être adverbes sans -ly ; hardly signifie presque pas."]),
            _lesson("a2-too-enough", "Too et enough", "too + adjectif/adverbe | adjectif/adverbe + enough | enough + nom", "Too marque un excès souvent problématique ; enough indique une quantité ou un degré suffisant. La position de enough varie selon qu'il accompagne un nom ou un adjectif.", [("The bag is too heavy to carry.", "Le sac est trop lourd pour être porté."), ("She's old enough to drive.", "Elle est assez âgée pour conduire."), ("We have enough chairs for everyone.", "Nous avons assez de chaises pour tout le monde.")], ["Too much accompagne un indénombrable ; too many, un pluriel dénombrable.", "Not ... enough exprime une insuffisance : not warm enough."]),
            _lesson("a2-modals-obligation", "Obligation et permission : must, have to, can", "must + base | have/has to + base | can + base", "Must exprime une obligation forte ou personnelle ; have to une nécessité souvent liée aux circonstances. Can et may permettent d'accorder une permission.", [("You must wear a helmet.", "Tu dois porter un casque."), ("I have to catch the early train.", "Je dois prendre le train tôt."), ("Can we leave a little earlier?", "Pouvons-nous partir un peu plus tôt ?")], ["Mustn't signifie interdit ; don't have to signifie que ce n'est pas nécessaire.", "Must n'a pas de forme passée usuelle : employez had to."]),
            _lesson("a2-gerunds-infinitives", "Gérondif et infinitif après les verbes", "verbe + -ing | verbe + to + infinitif (selon le verbe)", "Certains verbes sont suivis d'un gérondif, d'autres d'un infinitif en to. La construction fait partie du comportement du verbe et se mémorise avec lui.", [("I enjoy reading before bed.", "J'aime lire avant de dormir."), ("She decided to study abroad.", "Elle a décidé d'étudier à l'étranger."), ("They want to leave early.", "Ils veulent partir tôt.")], ["Après une préposition, le verbe prend généralement -ing.", "Certains verbes acceptent les deux formes avec un changement de sens : stop doing/stop to do."]),
            _lesson("a2-preposition-gerund", "Verbe en -ing après une préposition", "préposition + nom/pronom/verbe en -ing", "Un verbe qui suit une préposition se met au gérondif. Cette règle s'applique même lorsque la préposition appartient à une expression comme interested in ou good at.", [("She's interested in learning Japanese.", "Elle s'intéresse à l'apprentissage du japonais."), ("Thank you for helping us.", "Merci de nous avoir aidés."), ("He left without saying goodbye.", "Il est parti sans dire au revoir.")], ["To est parfois une préposition : look forward to meeting you.", "La forme -ing est ici un nom verbal, pas un temps continu."]),
        ]},
        {"id": "a2-reference-and-modifiers", "title": "Référence et modificateurs", "topics": [
            _lesson("a2-possessive-pronouns", "Possessif en 's, of et pronoms possessifs", "possesseur + 's + nom | nom + of + possesseur | mine/yours/his...", "Choisissez la construction selon le possesseur et le registre. Les pronoms possessifs remplacent tout le groupe nominal, tandis que l'adjectif possessif précède le nom.", [("This is Olivia's desk.", "C'est le bureau d'Olivia."), ("A friend of mine lives nearby.", "Un de mes amis habite à proximité."), ("The handle of the door is loose.", "La poignée de la porte est desserrée.")], ["Don't confond l'abréviation de do not et le possessif dont.", "Le double génitif a friend of mine est courant et grammatical."]),
            _lesson("a2-indefinite-pronouns", "Pronoms indéfinis en some-, any-, no-", "some/any/no + -one/-body/-thing/-where", "Ces composés désignent une personne, une chose ou un lieu sans les identifier. Some apparaît souvent en affirmation ; any dans les questions et négations ; no porte déjà la négation.", [("Someone left a message for you.", "Quelqu'un vous a laissé un message."), ("I couldn't find anything.", "Je n'ai rien trouvé."), ("Would you like something to drink?", "Voulez-vous boire quelque chose ?")], ["Les composés en -one/-body prennent généralement un verbe singulier.", "N'ajoutez pas une seconde négation après nobody/nothing en anglais standard."]),
        ]},
    ],
    "B1": [
        {"id": "b1-questions-and-reporting", "title": "Questions et discours rapporté", "topics": [
            _lesson("b1-question-tags", "Question tags", "affirmation + tag négatif | négation + tag affirmatif", "Une question tag courte sollicite une confirmation ou maintient le contact. Elle reprend l'auxiliaire et le sujet de la proposition principale.", [("You've met Alex, haven't you?", "Tu as rencontré Alex, n'est-ce pas ?"), ("She isn't coming, is she?", "Elle ne vient pas, si ?"), ("Let's start, shall we?", "Commençons, d'accord ?")], ["Avec I am, le tag standard est aren't I ?", "L'intonation montante demande une vraie confirmation ; la descendante attend plutôt l'accord."]),
            _lesson("b1-indirect-questions", "Questions indirectes et politesse", "introducteur + mot Wh + sujet + verbe | introducteur + if/whether + sujet + verbe", "Une question indirecte adoucit une demande ou s'intègre dans une proposition. Après l'introducteur, elle reprend l'ordre déclaratif et n'a pas d'inversion auxiliaire-sujet.", [("Could you tell me where the station is?", "Pourriez-vous me dire où se trouve la gare ?"), ("Do you know if they are open?", "Savez-vous s'ils sont ouverts ?"), ("I'd like to know what time it starts.", "J'aimerais savoir à quelle heure cela commence.")], ["Ne dites pas where is the station après Could you tell me.", "La ponctuation finale dépend de la phrase entière, pas seulement de la question intégrée."]),
            _lesson("b1-reported-questions", "Discours indirect : questions", "asked + (object) + Wh/if + sujet + verbe au discours rapporté", "Le discours indirect transforme une question en proposition déclarative après ask/wonder. L'ordre des mots redevient sujet-verbe et les temps peuvent reculer si le verbe introducteur est au passé.", [("'Where do you live?' → She asked where I lived.", "« Où habites-tu ? » → Elle m'a demandé où j'habitais."), ("'Are they ready?' → He asked if they were ready.", "« Sont-ils prêts ? » → Il a demandé s'ils étaient prêts."), ("'What happened?' → I wondered what had happened.", "« Que s'est-il passé ? » → Je me suis demandé ce qui s'était passé.")], ["N'utilisez pas do/does/did dans la question indirecte.", "If et whether introduisent les questions oui/non ; whether est nécessaire devant un infinitif ou or not dans certaines structures."]),
            _lesson("b1-future-forms", "Nuances des formes du futur", "will : décision/prédiction | going to : intention/indice | présent continu : arrangement", "L'anglais ne possède pas un unique temps futur. La forme choisie précise si l'on réagit sur le moment, annonce un projet, prédit à partir d'indices ou décrit un arrangement organisé.", [("I'll carry that for you.", "Je vais porter cela pour toi."), ("It's going to be a difficult year.", "Cela va être une année difficile."), ("We're having dinner with Jo tonight.", "Nous dînons avec Jo ce soir.")], ["Le present simple sert aux horaires fixes : The train leaves at 8.", "Will ne suit généralement pas if/when dans la subordonnée temporelle."]),
            _lesson("b1-second-conditional", "Deuxième conditionnel", "If + past simple, would + base verbale", "Cette structure imagine une situation présente ou future éloignée de la réalité ou considérée peu probable. Le prétérit marque la distance, pas nécessairement le passé.", [("If I lived by the sea, I'd swim every day.", "Si j'habitais près de la mer, je nagerais tous les jours."), ("What would you do if you won?", "Que ferais-tu si tu gagnais ?"), ("If she were here, she'd know what to do.", "Si elle était ici, elle saurait quoi faire.")], ["Were est la forme soutenue traditionnelle avec toutes les personnes : If I were you.", "Would est normalement absent de la proposition introduite par if."]),
        ]},
        {"id": "b1-verb-patterns-and-reference", "title": "Verbes, références et habitudes", "topics": [
            _lesson("b1-gerund-infinitive-meaning", "Verbes suivis de -ing ou de to", "verbe + -ing / to + infinitif selon le verbe et le sens", "Le choix entre gérondif et infinitif dépend du verbe précédent. Certains verbes acceptent les deux formes sans différence importante ; d'autres changent de sens.", [("I stopped smoking last year.", "J'ai arrêté de fumer l'an dernier."), ("We stopped to get some water.", "Nous nous sommes arrêtés pour prendre de l'eau."), ("She remembers meeting him at school.", "Elle se souvient de l'avoir rencontré à l'école.")], ["Remember to do porte sur une tâche future ; remember doing porte sur un souvenir.", "Après enjoy, avoid et suggest, le gérondif est attendu."]),
            _lesson("b1-used-to-would", "Used to et would pour les habitudes passées", "used to + base : état/habitude passée | would + base : action répétée passée", "Used to décrit un état ou une habitude qui n'existe plus. Would raconte des actions répétées dans un cadre passé déjà établi.", [("I used to have very long hair.", "J'avais les cheveux très longs autrefois."), ("Every summer, we'd visit my grandparents.", "Chaque été, nous rendions visite à mes grands-parents."), ("Did you use to play tennis?", "Jouais-tu au tennis autrefois ?")], ["Would ne décrit pas normalement un état : on ne remplace pas used to have par would have.", "La question et la négation utilisent souvent use to après did/didn't."]),
            _lesson("b1-non-defining-relatives", "Relatives déterminatives et explicatives", "déterminative : nom + who/which/that (sans virgule) | explicative : , who/which,", "Une relative déterminative identifie le référent et ne se sépare pas par des virgules. Une relative explicative ajoute une information secondaire et s'encadre de virgules.", [("The people who live next door are doctors.", "Les personnes qui habitent à côté sont médecins."), ("My brother, who lives in Leeds, is visiting.", "Mon frère, qui habite à Leeds, vient nous voir."), ("The laptop, which I bought last year, still works.", "L'ordinateur, que j'ai acheté l'an dernier, fonctionne toujours.")], ["That ne s'emploie pas dans une relative explicative.", "On ne supprime pas le pronom relatif lorsqu'il est sujet de la proposition."]),
            _lesson("b1-articles-and-zero", "Articles et noms génériques", "the + nom singulier : catégorie/instrument | Ø + pluriel/indénombrable : généralité", "L'article change selon que le nom renvoie à un élément précis ou à une catégorie entière. Les noms abstraits et les institutions suivent des usages idiomatiques.", [("The bicycle is an efficient form of transport.", "Le vélo est un moyen de transport efficace."), ("Children need regular sleep.", "Les enfants ont besoin de dormir régulièrement."), ("She goes to university in Bristol.", "Elle étudie à l'université de Bristol.")], ["On dit play the piano mais play football.", "L'article peut varier selon le sens : go to school (activité) / go to the school (bâtiment précis)."]),
        ]},
        {"id": "b1-practical-structures", "title": "Structures utiles", "topics": [
            _lesson("b1-have-something-done", "Faire faire : have/get something done", "sujet + have/get + objet + participe passé", "Cette construction indique qu'un service ou une action est réalisé par quelqu'un d'autre pour le sujet. Get est souvent plus informel que have.", [("I'm having my hair cut tomorrow.", "Je me fais couper les cheveux demain."), ("We got the heating repaired.", "Nous avons fait réparer le chauffage."), ("She had her bag stolen on the train.", "Elle s'est fait voler son sac dans le train.")], ["Le participe passé s'accorde avec l'action subie, pas avec le sujet.", "La structure peut aussi décrire un événement négatif subi, sans intention : have something stolen."]),
            _lesson("b1-purpose-infinitive", "But et infinitif de but", "to/in order to/so as to + base | so that + sujet + verbe", "L'infinitif de but exprime l'objectif d'une action lorsque le sujet est identique. So that introduit une proposition avec son propre sujet, souvent avec can/could.", [("I went online to book a table.", "Je suis allé en ligne pour réserver une table."), ("She spoke slowly so that everyone could understand.", "Elle a parlé lentement pour que tout le monde puisse comprendre."), ("He left early in order to avoid traffic.", "Il est parti tôt afin d'éviter les embouteillages.")], ["N'utilisez pas for + infinitif pour exprimer le but d'une action en anglais standard.", "In order to et so as to sont plus formels que to."]),
        ]},
    ],
    "B2": [
        {"id": "b2-conditionals-and-causatives", "title": "Hypothèses et constructions causatives", "topics": [
            _lesson("b2-mixed-conditionals", "Conditionnels mixtes", "If + past perfect, would + base (passé → conséquence présente) | If + past, would have + participe passé (présent → passé)", "Les conditionnels mixtes relient une condition située dans un temps à une conséquence située dans un autre. Le choix des temps rend explicite cette relation temporelle croisée.", [("If I had taken that job, I would live abroad now.", "Si j'avais accepté ce poste, je vivrais à l'étranger maintenant."), ("If she were more organised, she wouldn't have missed the train.", "Si elle était plus organisée, elle n'aurait pas raté le train."), ("He wouldn't be tired if he had gone to bed earlier.", "Il ne serait pas fatigué s'il s'était couché plus tôt.")], ["Vérifiez séparément le temps de la condition et celui du résultat.", "Would reste normalement absent de la proposition if."]),
            _lesson("b2-get-passive", "Get-passive et changements subis", "sujet + get + participe passé", "Get-passive présente souvent un changement, un événement inattendu ou une expérience affectant le sujet. Il est plus conversationnel que be-passive.", [("He got promoted last month.", "Il a été promu le mois dernier."), ("My phone got damaged in the rain.", "Mon téléphone a été abîmé par la pluie."), ("They got stuck in traffic.", "Ils se sont retrouvés coincés dans les embouteillages.")], ["Get + participe passé peut être adjectival ou passif selon le contexte.", "Évitez cette forme dans les textes académiques formels lorsqu'un passif en be convient mieux."]),
            _lesson("b2-have-something-done", "Causatif : have/get something done", "have/get + objet + participe passé | have + personne + base", "Le causatif distingue le service reçu de la personne qui exécute l'action. Have/get + objet + participe passé présente la prestation ; have + personne + base nomme l'agent.", [("We had the documents translated.", "Nous avons fait traduire les documents."), ("I'll get someone to check the wiring.", "Je vais demander à quelqu'un de vérifier le câblage."), ("The manager had the team rewrite the report.", "La responsable a fait réécrire le rapport par l'équipe.")], ["Get + personne est suivi de to + infinitif ; have + personne est suivi de la base.", "Get something done peut insister sur l'effort pour obtenir le résultat."]),
            _lesson("b2-reporting-passive", "Structures passives de discours rapporté", "It + be + participe passé + that-clause | sujet + be + participe passé + to-infinitive", "Les constructions passives de reporting permettent de présenter une information comme rapportée ou généralement admise, sans nommer précisément la source.", [("It is believed that the painting is authentic.", "On pense que le tableau est authentique."), ("The painting is believed to be authentic.", "Le tableau serait authentique."), ("The suspect is said to have left the country.", "Le suspect aurait quitté le pays.")], ["Utilisez to have + participe passé lorsque l'action rapportée est antérieure.", "La tournure est fréquente avec say, believe, report, expect et know."]),
        ]},
        {"id": "b2-clauses-and-nuance", "title": "Subordination et nuance", "topics": [
            _lesson("b2-non-defining-relatives", "Relatives non déterminatives avancées", "nom, who/which/whose/where + proposition, | préposition + whom/which", "Les relatives non déterminatives ajoutent une précision sans sélectionner le référent. En registre formel, la préposition peut précéder whom ou which.", [("The committee, whose members were elected in June, met today.", "Le comité, dont les membres ont été élus en juin, s'est réuni aujourd'hui."), ("The proposal, to which we objected, was withdrawn.", "La proposition, à laquelle nous nous opposions, a été retirée."), ("Her studio, where she works at night, is upstairs.", "Son atelier, où elle travaille la nuit, est à l'étage.")], ["That ne remplace pas who/which dans une relative explicative.", "Une préposition placée avant le pronom exclut that et l'omission du pronom."]),
            _lesson("b2-participle-clauses", "Participiales et propositions réduites", "participe présent/passé + proposition | having + participe passé : antériorité", "Les propositions participiales condensent une subordonnée et rendent l'écrit plus dense. Le sujet logique de la participiale doit correspondre au sujet de la proposition principale.", [("Having checked the figures, we approved the budget.", "Après avoir vérifié les chiffres, nous avons approuvé le budget."), ("Built in the nineteenth century, the station is still in use.", "Construite au XIXe siècle, la gare est toujours en service."), ("While waiting for the result, she checked her email.", "En attendant le résultat, elle a consulté ses courriels.")], ["Un sujet logique différent crée une participiale mal rattachée.", "Being peut souvent être omis devant un participe passé : (Being) located near the river…"]),
            _lesson("b2-modals-speculation", "Modaux de spéculation et degrés de certitude", "must + base : forte certitude | may/might/could : possibilité | can't : impossibilité", "Les modaux expriment des degrés de confiance plutôt que des faits certains. Pour une hypothèse passée, ajoutez have + participe passé après le modal.", [("They must be waiting outside.", "Ils doivent attendre dehors."), ("She may have taken the earlier train.", "Elle a peut-être pris le train précédent."), ("That can't be the right address.", "Ce ne peut pas être la bonne adresse.")], ["Mustn't exprime l'interdiction, pas une déduction négative.", "Could have peut exprimer une possibilité passée ou un reproche selon le contexte."]),
            _lesson("b2-articles-abstract", "Articles avec noms abstraits et institutions", "Ø : notion générale/institution | the : référent précis ou institution comme lieu", "Les noms abstraits et les noms d'institutions prennent ou non un article selon que l'on parle de leur fonction générale, d'une notion ou d'un élément particulier.", [("Education is a public priority.", "L'éducation est une priorité publique."), ("The education she received was excellent.", "L'éducation qu'elle a reçue était excellente."), ("He is in prison, but his lawyer went to the prison.", "Il est en prison, mais son avocat s'est rendu à la prison.")], ["Les usages institutionnels varient selon le nom et l'anglais britannique/américain.", "Un complément déterminatif peut rendre un nom abstrait spécifique et appeler the."]),
        ]},
        {"id": "b2-emphasis-and-linking", "title": "Emphase et cohésion", "topics": [
            _lesson("b2-inversion-emphasis", "Inversion avec so/such et expressions restrictives", "So + adjectif + be + sujet + that... | Not until/only then + auxiliaire + sujet + verbe", "Certaines structures emphatiques placent l'auxiliaire avant le sujet après un élément restrictif ou intensif en tête de phrase.", [("So difficult was the exam that many students ran out of time.", "L'examen était si difficile que beaucoup d'étudiants ont manqué de temps."), ("Not until midnight did they reach the village.", "Ils n'ont atteint le village qu'à minuit."), ("Only after the meeting did I understand the decision.", "Ce n'est qu'après la réunion que j'ai compris la décision.")], ["Sans inversion, la structure peut être incorrecte après not until/only + complément initial.", "L'inversion est formelle et ne convient pas à toutes les conversations."]),
            _lesson("b2-concession-linkers", "Connecteurs de concession et de contraste", "although/even though + proposition | despite/in spite of + nom/-ing", "Les connecteurs concessifs reconnaissent un fait qui contraste avec la proposition principale. Leur grammaire dépend du fait qu'ils introduisent une proposition ou un groupe nominal.", [("Although the route was longer, it was safer.", "Bien que l'itinéraire fût plus long, il était plus sûr."), ("Despite feeling nervous, she gave a clear presentation.", "Malgré son trac, elle a fait une présentation claire."), ("The product is expensive; nevertheless, demand is rising.", "Le produit est cher ; néanmoins, la demande augmente.")], ["Despite ne se construit pas directement avec une proposition finie : despite the fact that… est possible.", "However et nevertheless sont des adverbes de liaison ; la ponctuation doit marquer la frontière."]),
        ]},
    ],
    "C1": [
        {"id": "c1-clause-architecture", "title": "Architecture des propositions", "topics": [
            _lesson("c1-noun-clauses", "Propositions nominales et contenu rapporté", "that/wh-/whether + sujet + verbe comme sujet, complément ou attribut", "Une proposition nominale occupe la place d'un groupe nominal dans une phrase. Elle peut exprimer une information, une question indirecte ou une alternative incertaine.", [("What she proposes seems reasonable.", "Ce qu'elle propose semble raisonnable."), ("The issue is whether we have enough time.", "La question est de savoir si nous avons assez de temps."), ("I can't explain why the figures changed.", "Je ne peux pas expliquer pourquoi les chiffres ont changé.")], ["Les questions intégrées gardent l'ordre déclaratif.", "That peut être omis quand la proposition est complément, mais reste souvent présent après un nom sujet."]),
            _lesson("c1-complex-conditionals", "Conditionnels complexes et alternatives", "if/unless/provided that/as long as + temps approprié | inversion formelle", "Les conditionnels avancés expriment des conditions nécessaires, des réserves ou des scénarios mixtes. Le choix du connecteur modifie la force logique de la condition.", [("Provided that funding is approved, the project can proceed.", "À condition que le financement soit approuvé, le projet peut avancer."), ("Were the figures accurate, the conclusion would be different.", "Si les chiffres étaient exacts, la conclusion serait différente."), ("Unless we act now, the opportunity will disappear.", "Si nous n'agissons pas maintenant, l'occasion disparaîtra.")], ["Unless signifie if not ; évitez une seconde négation non voulue.", "Provided that et as long as posent une condition, whereas even if exprime une concession."]),
            _lesson("c1-inversion-only", "Inversion après expressions restrictives", "Only + complément en tête + auxiliaire + sujet + verbe", "Only then, only after, not until et under no circumstances déclenchent une inversion dans la proposition principale lorsqu'ils sont placés en tête.", [("Only after reviewing the evidence did the panel decide.", "Ce n'est qu'après examen des preuves que le comité a décidé."), ("Under no circumstances should the data be shared.", "En aucun cas les données ne doivent être partagées."), ("Not until the lights came on did we notice the damage.", "Ce n'est qu'au moment où les lumières se sont allumées que nous avons remarqué les dégâts.")], ["La subordonnée après only after garde l'ordre normal ; l'inversion vient dans la principale.", "Si l'expression restrictive n'est pas en tête, il n'y a pas d'inversion."]),
        ]},
        {"id": "c1-precision-and-register", "title": "Précision et registre", "topics": [
            _lesson("c1-advanced-modality", "Modalité épistémique et nuance", "modal + base / modal + have + participe passé | modal + be + -ing", "Les modaux nuancent la probabilité, l'inférence et l'attitude du locuteur. Les formes perfect et continuous précisent respectivement l'antériorité et le déroulement.", [("The figures could be misleading.", "Les chiffres pourraient être trompeurs."), ("They must have been waiting for hours.", "Ils doivent attendre depuis des heures."), ("She may be working from home today.", "Il se peut qu'elle travaille de chez elle aujourd'hui.")], ["May et might diffèrent souvent plus par le registre ou la prudence que par une probabilité mesurable.", "Can't have exprime une forte impossibilité passée ; must have une déduction forte."]),
            _lesson("c1-determiners-quantifiers", "Déterminants avancés et quantifieurs", "all/both/half + déterminant | each/every + singulier | few/little + nom", "Les quantifieurs avancés distinguent la totalité, la distribution et la quantité insuffisante. Leur accord et leur nuance dépendent du type de nom et de la présence d'un déterminant.", [("Both of the proposals are viable.", "Les deux propositions sont réalisables."), ("Each applicant was interviewed.", "Chaque candidat a été reçu en entretien."), ("We have little evidence to support the claim.", "Nous avons peu d'éléments pour étayer cette affirmation.")], ["Few/little suggèrent une quantité insuffisante ; a few/a little une petite quantité disponible.", "Every s'emploie avec un nom singulier ; all peut accompagner un pluriel ou un indénombrable."]),
            _lesson("c1-nominalisation", "Nominalisation et densité académique", "verbe/adjectif + suffixe nominal | nom + of/complément", "La nominalisation transforme un processus ou une qualité en nom. Elle permet de structurer un texte académique, mais une accumulation peut rendre le style abstrait et lourd.", [("The committee decided to postpone the vote.", "Le comité a décidé de reporter le vote."), ("The committee's decision to postpone the vote was announced.", "La décision du comité de reporter le vote a été annoncée."), ("The policy changed rapidly.", "La politique a changé rapidement.")], ["Gardez l'agent explicite si la nominalisation masque qui agit.", "Préférez le verbe lorsque la nominalisation n'apporte ni cohésion ni précision."]),
            _lesson("c1-ellipsis-substitution", "Ellipse et substitution avancées", "so/neither + auxiliaire + sujet | do so/one(s)/that/those pour substituer", "L'ellipse supprime une information récupérable ; la substitution remplace un groupe répété. Ces procédés améliorent la cohésion mais exigent un antécédent clair.", [("The first report was detailed; the second was less so.", "Le premier rapport était détaillé ; le second l'était moins."), ("She objected, as did several colleagues.", "Elle s'y est opposée, comme plusieurs collègues."), ("We need a solution, and a practical one.", "Il nous faut une solution, et une solution pratique.")], ["So reprend souvent un adjectif ou un adverbe ; do so reprend une action.", "L'auxiliaire de reprise doit correspondre au temps et à la voix du contexte."]),
        ]},
    ],
    "C2": [
        {"id": "c2-aspect-and-stance", "title": "Aspect et posture du locuteur", "topics": [
            _lesson("c2-aspect-meaning", "Aspect : états, activités et accomplissements", "simple/continuous/perfect choisis selon état, durée, résultat ou répétition", "Le choix aspectuel présente un événement comme état, activité en cours, expérience ou résultat. Il dépend du sens du verbe et du point de vue du locuteur, pas seulement d'une date.", [("I've read the report.", "J'ai lu le rapport (il est lu / expérience accomplie)."), ("I've been reading the report.", "Je lis le rapport depuis un moment (activité en cours/récente)."), ("She was being unusually cautious.", "Elle se montrait inhabituellement prudente.")], ["Les verbes d'état se combinent rarement avec le continu, sauf changement de sens ou comportement temporaire.", "Le present perfect simple met souvent en avant le résultat ; le continuous, l'activité ou sa durée."]),
            _lesson("c2-subjunctive", "Subjonctif mandatif et irréel", "that + sujet + base verbale | were pour l'irréel | should + base (variante)", "Le subjonctif mandatif apparaît dans les recommandations, exigences et propositions formelles. Le subjonctif irréel marque une situation hypothétique ou contraire aux faits.", [("They insisted that the clause be removed.", "Ils ont insisté pour que la clause soit supprimée."), ("It is vital that every witness remain available.", "Il est essentiel que chaque témoin reste disponible."), ("If this were to happen, the consequences would be serious.", "Si cela devait arriver, les conséquences seraient graves.")], ["La base verbale ne porte pas -s à la troisième personne.", "Should est fréquent en anglais britannique formel ; l'indicatif est courant dans d'autres variétés."]),
            _lesson("c2-fronting-information", "Fronting et structure informationnelle", "information connue/contrastée en tête + commentaire/focus en fin", "Le fronting organise la phrase selon ce qui est déjà connu, contrasté ou mis en relief. Il contribue à la cohésion et au rythme, au-delà de la seule grammaire de proposition.", [("This question, we can answer later.", "Cette question, nous pourrons y répondre plus tard."), ("Particularly difficult was the final section.", "La dernière section était particulièrement difficile."), ("What matters most is the evidence.", "Ce qui importe le plus, ce sont les preuves.")], ["L'inversion dépend de la construction : un simple complément en tête ne la déclenche pas toujours.", "Un fronting excessif peut rendre le texte artificiel ou théâtral."]),
            _lesson("c2-register-variation", "Variation grammaticale et registre", "choix de structure selon oral/écrit, formalité, dialecte et focus", "À maîtrise avancée, plusieurs formes peuvent être grammaticales mais diffèrent en registre, rythme, variété régionale ou implication. La décision doit tenir compte du public et du genre de texte.", [("Who did you speak to? / To whom did you speak?", "À qui as-tu parlé ? (courant / très formel)"), ("The team are reviewing the data. (BrE)", "L'équipe examine les données. (accord collectif britannique)"), ("The team is reviewing the data. (AmE)", "L'équipe examine les données. (accord collectif américain)")], ["Évitez de qualifier d'incorrecte une variante standard propre à une autre variété d'anglais.", "Dans un même texte, gardez une cohérence de registre et de variété."]),
        ]},
    ],
}


for level, categories in EXTENDED_CATEGORIES.items():
    ROADMAPS[level]["categories"].extend(categories)


TOPIC_FORMULAS = {
    "a1-be": "Sujet + am / is / are + complément",
    "a1-word-order": "Affirmation : sujet + verbe + complément | Question : do/does + sujet + base verbale",
    "a1-present-simple": "Sujet + base verbale (+ -s/-es à he/she/it)",
    "a1-articles-plurals": "a/an + nom singulier | nom pluriel : nom + -s/-es (ou forme irrégulière)",
    "a1-adjectives": "Adjectif + nom | this/that + nom singulier | these/those + nom pluriel",
    "a1-prepositions": "in + période/espace | on + jour/surface | at + heure/point précis",
    "a2-past-simple": "Sujet + verbe au prétérit | Question : did + sujet + base verbale",
    "a2-past-continuous": "Sujet + was/were + verbe en -ing",
    "a2-future": "be going to + base verbale | will + base verbale",
    "a2-quantifiers": "many + nom dénombrable | much + nom indénombrable | some/any + nom",
    "a2-comparatives": "Adjectif court + -er + than | more + adjectif long + than | the + superlatif",
    "a2-connectors": "Proposition + and/but/because/so + proposition",
    "b1-present-perfect": "have/has + participe passé | past simple : verbe au prétérit",
    "b1-present-perfect-continuous": "have/has + been + verbe en -ing",
    "b1-modals": "Sujet + modal + base verbale | have to + base verbale",
    "b1-conditionals": "If + présent, présent (zéro) | If + présent, will + base (premier)",
    "b1-relative-clauses": "Antécédent + who/which/that/where + proposition relative",
    "b1-passive": "Sujet patient + be conjugué + participe passé (+ by + agent)",
    "b2-past-perfect": "Sujet + had + participe passé",
    "b2-future-perfect": "will have + participe passé | will be + verbe en -ing",
    "b2-passive-forms": "Sujet patient + be au temps voulu + participe passé",
    "b2-reported-speech": "sujet + said/told + (that) + proposition avec recul des temps",
    "b2-conditionals": "If + past, would + base | If + past perfect, would have + participe passé",
    "b2-modals-deduction": "modal + base (présent) | modal + have + participe passé (passé)",
    "c1-inversion": "Adverbe négatif en tête + auxiliaire + sujet + verbe",
    "c1-cleft-sentences": "It + be + élément focalisé + who/that + proposition | What + proposition + be + focus",
    "c1-modal-perfect": "should/could/needn't + have + participe passé",
    "c1-subjunctive": "verbe de recommandation + that + sujet + base verbale",
    "c1-hedging": "sujet + tend/appears/seems to + verbe | may/might + base verbale",
    "c1-participles": "Participe présent/passé en tête + proposition principale au sujet logique identique",
    "c2-inversion-conditionals": "Were/Had/Should + sujet + complément, proposition principale",
    "c2-fronting": "Élément contrasté en tête + proposition (ordre adapté à la structure)",
    "c2-subjunctive-were": "If + sujet + were | wish + past (regret présent) / past perfect (regret passé)",
    "c2-verb-patterns": "verbe + gérondif (-ing) ou verbe + to + infinitif (sens dépendant du verbe)",
    "c2-concession": "although + proposition | despite + nom/gérondif | proposition ; however, proposition",
    "c2-ellipsis-substitution": "so/neither + auxiliaire + sujet | one(s)/do so pour reprendre un élément",
}


def _prepare_lesson_catalog() -> None:
    for roadmap in ROADMAPS.values():
        for category in roadmap["categories"]:
            for topic in category["topics"]:
                topic_id = topic["id"]
                examples = topic["examples"]
                topic["formula"] = topic.get("formula") or TOPIC_FORMULAS[topic_id]
                topic["explanation"] = topic.get("explanation") or topic["rule"]
                choice_offset = sum(map(ord, topic_id)) % len(examples)
                choices = examples[choice_offset:] + examples[:choice_offset]
                blank_prefix, blank_word = examples[2]["english"].rsplit(" ", 1)
                blank_answer = blank_word.rstrip(".,!?;:")
                blank_suffix = blank_word[len(blank_answer):]
                topic["exercises"] = [
                    {
                        "id": f"{topic_id}-choice",
                        "type": "multiple_choice",
                        "prompt": f"Quelle phrase correspond à : « {examples[0]['french']} » ?",
                        "options": [example["english"] for example in choices],
                        "answer": examples[0]["english"],
                        "explanation": topic["rule"],
                    },
                    {
                        "id": f"{topic_id}-rephrase",
                        "type": "rephrase",
                        "prompt": f"Reformulez en anglais : « {examples[1]['french']} »",
                        "answer": examples[1]["english"],
                        "explanation": topic["rule"],
                    },
                    {
                        "id": f"{topic_id}-fill-blank",
                        "type": "fill_blank",
                        "prompt": f"Complétez : « {blank_prefix} _____{blank_suffix} »",
                        "answer": blank_answer,
                        "explanation": topic["rule"],
                    },
                ]


_prepare_lesson_catalog()


def _find_topic(topic_id: str) -> tuple[str, dict, dict] | None:
    for level, roadmap in ROADMAPS.items():
        for category in roadmap["categories"]:
            for topic in category["topics"]:
                if topic["id"] == topic_id:
                    return level, category, topic
    return None


def _public_topic(topic: dict) -> dict:
    return {
        **topic,
        "exercises": [
            {key: value for key, value in exercise.items() if key not in {"answer", "explanation"}}
            for exercise in topic["exercises"]
        ],
    }


def _normalize_exercise_answer(answer: str) -> str:
    normalized = unicodedata.normalize("NFKC", answer).casefold().replace("’", "'")
    return re.sub(r"\s+", " ", normalized).strip().strip(".,!?;:'\" ")


@router.get("/levels")
async def list_levels() -> list[dict]:
    return [
        {"level": level, "title": roadmap["title"], "description": roadmap["description"],
         "topic_count": sum(len(category["topics"]) for category in roadmap["categories"])}
        for level, roadmap in ROADMAPS.items()
    ]


@router.get("/roadmap/{level}")
async def get_roadmap(level: str) -> dict:
    normalized_level = level.upper()
    if normalized_level not in ROADMAPS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grammar level not found")
    roadmap = ROADMAPS[normalized_level]
    return {
        "level": normalized_level,
        "title": roadmap["title"],
        "description": roadmap["description"],
        "categories": [
            {
                **category,
                "topics": [_public_topic(topic) for topic in category["topics"]],
            }
            for category in roadmap["categories"]
        ],
    }


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str) -> dict:
    found = _find_topic(topic_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grammar topic not found")
    level, category, topic = found
    return {"level": level, "category": category["title"], **_public_topic(topic)}


@router.post("/topics/{topic_id}/exercises/{exercise_id}/check")
async def check_exercise(topic_id: str, exercise_id: str, request: ExerciseCheckRequest) -> dict:
    found = _find_topic(topic_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grammar topic not found")
    exercise = next(
        (item for item in found[2]["exercises"] if item["id"] == exercise_id),
        None,
    )
    if exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grammar exercise not found")
    return {
        "exercise_id": exercise_id,
        "correct": _normalize_exercise_answer(request.answer)
        == _normalize_exercise_answer(exercise["answer"]),
        "answer": exercise["answer"],
        "explanation": exercise["explanation"],
    }


@router.post("/topics/{topic_id}/enrich")
async def enrich_topic(topic_id: str, request: EnrichmentRequest) -> dict:
    found = _find_topic(topic_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grammar topic not found")
    if not settings.groq_api_key or not settings.groq_model.strip():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Groq is not configured")

    level, category, topic = found
    prompt = (
        "Réponds uniquement avec un objet JSON valide contenant les clés explanation (string) et "
        "exercises (tableau de 3 objets {question, answer, explanation}). Écris en français, "
        "avec des exemples en anglais adaptés au CECR. N'invente pas de règle contraire au cours.\n"
        f"Niveau : {level}. Thème : {topic['title']}. Règle : {topic['rule']}\n"
        f"Point à approfondir : {request.focus or 'explication et pratique équilibrées'}"
    )
    payload = {
        "model": settings.groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": settings.groq_temperature,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json=payload,
            )
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        generated = json.loads(content)
        if not isinstance(generated.get("explanation"), str) or not isinstance(generated.get("exercises"), list):
            raise ValueError("Unexpected enrichment format")
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate grammar enrichment",
        ) from exc

    return {"topic_id": topic_id, "category": category["title"], **generated}