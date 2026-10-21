alter table public.vocabulary_catalog_items
    add column if not exists synonym_details jsonb not null default '[]'::jsonb
    check (jsonb_typeof(synonym_details) = 'array');

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"accomplish","register":"formal","nuance_fr":"Met l’accent sur l’achèvement réussi d’une tâche."},
    {"word":"attain","register":"formal","nuance_fr":"S’emploie surtout pour atteindre un niveau, un objectif ou un état."}
]'::jsonb
where slug = 'achieve';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"though","register":"familiar","nuance_fr":"Plus courant à l’oral et souvent plus concis."},
    {"word":"even though","register":"neutral","nuance_fr":"Souligne davantage le contraste ou le caractère inattendu."}
]'::jsonb
where slug = 'although';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"think about","register":"neutral","nuance_fr":"Invite à examiner une possibilité sans présumer d’une décision."},
    {"word":"regard","register":"formal","nuance_fr":"Plus soutenu; signifie considérer sous un certain angle."}
]'::jsonb
where slug = 'consider';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"recognize","register":"neutral","nuance_fr":"Constater ou identifier explicitement un fait ou une qualité."},
    {"word":"admit","register":"neutral","nuance_fr":"Reconnaître un fait, souvent malgré une hésitation ou à contrecœur."}
]'::jsonb
where slug = 'acknowledge';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"evaluate","register":"neutral","nuance_fr":"Juger la valeur ou la qualité à partir de critères."},
    {"word":"appraise","register":"formal","nuance_fr":"Estimer méthodiquement, souvent la valeur ou la performance."}
]'::jsonb
where slug = 'assess';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"ambiguous","register":"neutral","nuance_fr":"Peut simplement admettre plusieurs interprétations."},
    {"word":"uncertain","register":"neutral","nuance_fr":"Met plutôt l’accent sur le manque de certitude."}
]'::jsonb
where slug = 'equivocal';

update public.vocabulary_catalog_items
set synonym_details = '[
    {"word":"practical","register":"neutral","nuance_fr":"Met l’accent sur l’utilité et la mise en œuvre concrète."},
    {"word":"realistic","register":"neutral","nuance_fr":"Souligne la prise en compte des contraintes réelles."}
]'::jsonb
where slug = 'pragmatic';