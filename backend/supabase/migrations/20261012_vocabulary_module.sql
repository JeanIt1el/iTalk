create table if not exists public.vocabulary_collections (
    slug text primary key,
    title text not null,
    description text not null,
    icon text not null default 'book-open',
    cefr_level public.cefr_level not null,
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vocabulary_catalog_items (
    slug text primary key,
    word text not null,
    normalized_word text not null,
    translation_fr text not null,
    additional_meanings text[] not null default array[]::text[],
    part_of_speech text not null,
    cefr_level public.cefr_level not null,
    ipa text,
    example_en text not null,
    example_fr text not null,
    usage_note_fr text,
    synonyms text[] not null default array[]::text[],
    antonyms text[] not null default array[]::text[],
    collocations text[] not null default array[]::text[],
    tags text[] not null default array[]::text[],
    source_type text not null default 'seeded' check (source_type in ('seeded', 'ai_generated')),
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.vocabulary_collection_items (
    collection_slug text not null references public.vocabulary_collections(slug) on delete cascade,
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    position integer not null default 0 check (position >= 0),
    primary key (collection_slug, vocabulary_item_slug)
);

create table if not exists public.vocabulary_user_progress (
    user_id uuid not null references public.profiles(id) on delete cascade,
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    repetitions integer not null default 0 check (repetitions >= 0),
    interval_days integer not null default 0 check (interval_days >= 0),
    ease_factor numeric(4, 2) not null default 2.50 check (ease_factor between 1.30 and 3.00),
    successes integer not null default 0 check (successes >= 0),
    failures integer not null default 0 check (failures >= 0),
    mastery_level integer not null default 0 check (mastery_level between 0 and 5),
    last_reviewed_at timestamptz,
    next_review_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, vocabulary_item_slug)
);

create table if not exists public.vocabulary_favorites (
    user_id uuid not null references public.profiles(id) on delete cascade,
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, vocabulary_item_slug)
);

create table if not exists public.vocabulary_generated_words (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    normalized_word text not null,
    word text not null,
    translation_fr text not null,
    part_of_speech text not null,
    cefr_level public.cefr_level not null,
    ipa text not null default '',
    example_en text not null,
    example_fr text not null,
    usage_note_fr text not null,
    synonyms text[] not null default array[]::text[],
    tags text[] not null default array[]::text[],
    source_type text not null default 'ai_generated' check (source_type = 'ai_generated'),
    created_at timestamptz not null default now(),
    unique (user_id, normalized_word)
);

create table if not exists public.vocabulary_reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    request_id uuid not null,
    rating public.srs_rating not null,
    is_correct boolean not null,
    reviewed_at timestamptz not null default now(),
    next_review_at timestamptz not null,
    unique (user_id, request_id)
);

create table if not exists public.vocabulary_scenarios (
    slug text primary key,
    title text not null,
    description text not null,
    cefr_level public.cefr_level not null,
    learning_objective text not null,
    situation text not null,
    useful_phrases text[] not null default array[]::text[],
    is_published boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_scenario_items (
    scenario_slug text not null references public.vocabulary_scenarios(slug) on delete cascade,
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    position integer not null default 0 check (position >= 0),
    primary key (scenario_slug, vocabulary_item_slug)
);

create table if not exists public.vocabulary_quiz_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    vocabulary_item_slugs text[] not null,
    questions jsonb not null,
    correct_answers integer not null default 0 check (correct_answers >= 0),
    answered_count integer not null default 0 check (answered_count >= 0),
    status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
    score integer check (score between 0 and 100),
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create table if not exists public.vocabulary_quiz_answers (
    id uuid primary key default gen_random_uuid(),
    quiz_session_id uuid not null references public.vocabulary_quiz_sessions(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    question_index integer not null check (question_index >= 0),
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    submitted_answer text not null,
    is_correct boolean not null,
    answered_at timestamptz not null default now(),
    unique (quiz_session_id, question_index)
);

create table if not exists public.vocabulary_quiz_answer_keys (
    quiz_session_id uuid not null references public.vocabulary_quiz_sessions(id) on delete cascade,
    question_index integer not null check (question_index >= 0),
    vocabulary_item_slug text not null references public.vocabulary_catalog_items(slug) on delete cascade,
    correct_answer text not null,
    accepted_answers text[] not null default array[]::text[],
    explanation text not null,
    primary key (quiz_session_id, question_index)
);

create table if not exists public.vocabulary_ai_daily_usage (
    user_id uuid not null references public.profiles(id) on delete cascade,
    usage_date date not null,
    request_count integer not null default 0 check (request_count between 0 and 20),
    primary key (user_id, usage_date)
);

create index if not exists vocabulary_catalog_level_word_idx
    on public.vocabulary_catalog_items (cefr_level, normalized_word);
create index if not exists vocabulary_catalog_tags_idx
    on public.vocabulary_catalog_items using gin (tags);
create index if not exists vocabulary_collection_items_word_idx
    on public.vocabulary_collection_items (vocabulary_item_slug);
create index if not exists vocabulary_progress_due_idx
    on public.vocabulary_user_progress (user_id, next_review_at);
create index if not exists vocabulary_reviews_history_idx
    on public.vocabulary_reviews (user_id, reviewed_at desc);
create index if not exists vocabulary_quiz_user_idx
    on public.vocabulary_quiz_sessions (user_id, created_at desc);

alter table public.vocabulary_collections enable row level security;
alter table public.vocabulary_catalog_items enable row level security;
alter table public.vocabulary_collection_items enable row level security;
alter table public.vocabulary_user_progress enable row level security;
alter table public.vocabulary_favorites enable row level security;
alter table public.vocabulary_generated_words enable row level security;
alter table public.vocabulary_reviews enable row level security;
alter table public.vocabulary_scenarios enable row level security;
alter table public.vocabulary_scenario_items enable row level security;
alter table public.vocabulary_quiz_sessions enable row level security;
alter table public.vocabulary_quiz_answers enable row level security;
alter table public.vocabulary_quiz_answer_keys enable row level security;
alter table public.vocabulary_ai_daily_usage enable row level security;

drop policy if exists "Published vocabulary collections are readable" on public.vocabulary_collections;
create policy "Published vocabulary collections are readable"
    on public.vocabulary_collections for select using (is_published);
drop policy if exists "Published vocabulary items are readable" on public.vocabulary_catalog_items;
create policy "Published vocabulary items are readable"
    on public.vocabulary_catalog_items for select using (is_published);
drop policy if exists "Published vocabulary collection links are readable" on public.vocabulary_collection_items;
create policy "Published vocabulary collection links are readable"
    on public.vocabulary_collection_items for select using (
        exists (select 1 from public.vocabulary_collections c where c.slug = collection_slug and c.is_published)
    );
drop policy if exists "Users manage their vocabulary progress" on public.vocabulary_user_progress;
create policy "Users manage their vocabulary progress" on public.vocabulary_user_progress
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage their vocabulary favorites" on public.vocabulary_favorites;
create policy "Users manage their vocabulary favorites" on public.vocabulary_favorites
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage their generated vocabulary" on public.vocabulary_generated_words;
create policy "Users manage their generated vocabulary" on public.vocabulary_generated_words
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users read their vocabulary reviews" on public.vocabulary_reviews;
create policy "Users read their vocabulary reviews" on public.vocabulary_reviews
    for select using (user_id = auth.uid());
drop policy if exists "Published vocabulary scenarios are readable" on public.vocabulary_scenarios;
create policy "Published vocabulary scenarios are readable"
    on public.vocabulary_scenarios for select using (is_published);
drop policy if exists "Published scenario vocabulary is readable" on public.vocabulary_scenario_items;
create policy "Published scenario vocabulary is readable"
    on public.vocabulary_scenario_items for select using (
        exists (select 1 from public.vocabulary_scenarios s where s.slug = scenario_slug and s.is_published)
    );
drop policy if exists "Users manage their vocabulary quizzes" on public.vocabulary_quiz_sessions;
create policy "Users manage their vocabulary quizzes" on public.vocabulary_quiz_sessions
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Users manage their vocabulary quiz answers" on public.vocabulary_quiz_answers;
create policy "Users manage their vocabulary quiz answers" on public.vocabulary_quiz_answers
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.vocabulary_collections, public.vocabulary_catalog_items,
    public.vocabulary_collection_items, public.vocabulary_scenarios,
    public.vocabulary_scenario_items to authenticated;
grant select on public.vocabulary_user_progress to authenticated;
grant select, insert, update, delete on public.vocabulary_favorites to authenticated;
grant select, insert, delete on public.vocabulary_generated_words to authenticated;
grant select on public.vocabulary_quiz_sessions, public.vocabulary_quiz_answers to authenticated;
grant select, insert on public.vocabulary_reviews to authenticated;
revoke all on public.vocabulary_quiz_answer_keys from anon, authenticated;

insert into public.vocabulary_collections (slug, title, description, icon, cefr_level) values
('greetings-introductions', 'Salutations et présentations', 'Saluer, se présenter et faire connaissance.', 'handshake', 'A1'),
('daily-routine', 'Quotidien et loisirs', 'Les actions et habitudes de tous les jours.', 'sun', 'A1'),
('time-numbers', 'Temps, dates et nombres', 'Repères temporels et quantités courantes.', 'calendar-days', 'A1'),
('family-relations', 'Famille et relations', 'Les personnes de la famille et de l''entourage.', 'users', 'A1'),
('food-restaurant', 'Nourriture et restaurant', 'Aliments, repas et demandes au restaurant.', 'utensils', 'A1'),
('home-objects', 'Maison et objets', 'Pièces, mobilier et objets domestiques.', 'house', 'A1'),
('travel-transport', 'Voyage et transports', 'Se déplacer et préparer un trajet.', 'train-front', 'A2'),
('city-directions', 'Ville et itinéraires', 'Lieux utiles et indications dans une ville.', 'map', 'A2'),
('study-work', 'Études et travail', 'Apprentissage et vie professionnelle.', 'briefcase', 'A2'),
('health-wellbeing', 'Santé et bien-être', 'Santé, rendez-vous et habitudes de bien-être.', 'heart-pulse', 'A2'),
('weather-environment', 'Météo et environnement', 'Décrire le temps et son environnement.', 'cloud-sun', 'A2'),
('communication', 'Communication naturelle', 'Opinions, réactions et connecteurs utiles.', 'messages-square', 'A2')
on conflict (slug) do nothing;

insert into public.vocabulary_catalog_items
    (slug, word, normalized_word, translation_fr, part_of_speech, cefr_level, example_en, example_fr, usage_note_fr, tags)
values
('hello', 'hello', 'hello', 'bonjour, salut', 'interjection', 'A1', 'Hello, my name is Emma.', 'Bonjour, je m''appelle Emma.', 'Salutation neutre utilisable dans la plupart des situations.', array['greetings']),
('good-morning', 'good morning', 'good morning', 'bonjour (le matin)', 'expression', 'A1', 'Good morning, everyone.', 'Bonjour à tous.', 'S''emploie le matin ; good afternoon prend le relais plus tard.', array['greetings']),
('goodbye', 'goodbye', 'goodbye', 'au revoir', 'interjection', 'A1', 'Goodbye, and have a nice day.', 'Au revoir et bonne journée.', 'Forme neutre pour prendre congé.', array['greetings']),
('please', 'please', 'please', 's''il vous plaît', 'adverbe', 'A1', 'Could I have some water, please?', 'Pourrais-je avoir de l''eau, s''il vous plaît ?', 'Adoucit une demande ; sa position varie dans la phrase.', array['greetings', 'politeness']),
('thank-you', 'thank you', 'thank you', 'merci', 'expression', 'A1', 'Thank you for your help.', 'Merci pour votre aide.', 'Thank you est légèrement plus appuyé que thanks.', array['greetings', 'politeness']),
('youre-welcome', 'you''re welcome', 'you''re welcome', 'de rien', 'expression', 'A1', 'You''re welcome. See you tomorrow.', 'De rien. À demain.', 'Réponse courante à thank you.', array['greetings']),
('nice-to-meet-you', 'nice to meet you', 'nice to meet you', 'ravi(e) de vous rencontrer', 'expression', 'A1', 'Nice to meet you, Daniel.', 'Ravie de vous rencontrer, Daniel.', 'S''emploie lors d''une première rencontre.', array['greetings', 'introductions']),
('whats-your-name', 'what''s your name?', 'what is your name', 'comment vous appelez-vous ?', 'question', 'A1', 'Hi, what''s your name?', 'Bonjour, comment tu t''appelles ?', 'Forme courante ; what is your name est plus formel ou insistant.', array['greetings', 'introductions']),
('how-are-you', 'how are you?', 'how are you', 'comment allez-vous ?', 'question', 'A1', 'How are you today?', 'Comment allez-vous aujourd''hui ?', 'Peut être une formule de politesse ; la réponse peut rester brève.', array['greetings']),
('excuse-me', 'excuse me', 'excuse me', 'excusez-moi', 'expression', 'A1', 'Excuse me, is this seat free?', 'Excusez-moi, cette place est-elle libre ?', 'Attire l''attention ou précède une demande polie.', array['greetings', 'politeness']),
('wake-up', 'wake up', 'wake up', 'se réveiller', 'phrasal verb', 'A1', 'I wake up at seven on weekdays.', 'Je me réveille à sept heures en semaine.', 'Wake up désigne le réveil ; get up signifie sortir du lit.', array['daily-routine']),
('get-up', 'get up', 'get up', 'se lever', 'phrasal verb', 'A1', 'She gets up early for work.', 'Elle se lève tôt pour aller travailler.', 'Décrit le moment où l''on quitte son lit.', array['daily-routine']),
('get-dressed', 'get dressed', 'get dressed', 's''habiller', 'expression verbale', 'A1', 'The children get dressed after breakfast.', 'Les enfants s''habillent après le petit-déjeuner.', 'Get + adjectif décrit souvent un changement d''état.', array['daily-routine']),
('have-breakfast', 'have breakfast', 'have breakfast', 'prendre le petit-déjeuner', 'expression verbale', 'A1', 'We have breakfast together on Sundays.', 'Nous prenons le petit-déjeuner ensemble le dimanche.', 'Le nom breakfast s''emploie sans article dans cette expression.', array['daily-routine', 'food']),
('go-to-work', 'go to work', 'go to work', 'aller au travail', 'expression verbale', 'A1', 'He goes to work by bus.', 'Il va au travail en bus.', 'Work est sans article lorsqu''il désigne l''activité professionnelle.', array['daily-routine', 'work']),
('come-home', 'come home', 'come home', 'rentrer à la maison', 'expression verbale', 'A1', 'I come home at six.', 'Je rentre à la maison à six heures.', 'Home est ici un adverbe et ne prend pas de préposition.', array['daily-routine', 'home']),
('cook', 'cook', 'cook', 'cuisiner', 'verbe', 'A1', 'My father cooks dinner twice a week.', 'Mon père prépare le dîner deux fois par semaine.', 'Cook peut désigner l''action ou la personne (un cuisinier).', array['daily-routine', 'food']),
('clean', 'clean', 'clean', 'nettoyer, propre', 'verbe/adjectif', 'A1', 'We clean the kitchen after dinner.', 'Nous nettoyons la cuisine après le dîner.', 'Le sens dépend de la fonction : verbe ou adjectif.', array['daily-routine', 'home']),
('relax', 'relax', 'relax', 'se détendre', 'verbe', 'A1', 'I relax by reading in the evening.', 'Je me détends en lisant le soir.', 'Relax by est suivi d''un nom ou d''un verbe en -ing.', array['daily-routine', 'leisure']),
('weekend', 'weekend', 'weekend', 'week-end', 'nom', 'A1', 'What are you doing this weekend?', 'Qu''est-ce que tu fais ce week-end ?', 'S''écrit weekend en anglais américain et britannique courant.', array['daily-routine', 'time']),
('today', 'today', 'today', 'aujourd''hui', 'adverbe/nom', 'A1', 'The library is closed today.', 'La bibliothèque est fermée aujourd''hui.', 'Pas de préposition devant today.', array['time']),
('tomorrow', 'tomorrow', 'tomorrow', 'demain', 'adverbe/nom', 'A1', 'We are leaving tomorrow morning.', 'Nous partons demain matin.', 'Tomorrow morning ne prend pas de préposition.', array['time']),
('yesterday', 'yesterday', 'yesterday', 'hier', 'adverbe/nom', 'A1', 'I saw Maya yesterday.', 'J''ai vu Maya hier.', 'Pas de préposition devant yesterday.', array['time']),
('morning', 'morning', 'morning', 'matin', 'nom', 'A1', 'I go running in the morning.', 'Je vais courir le matin.', 'On dit in the morning, mais on Monday morning.', array['time']),
('afternoon', 'afternoon', 'afternoon', 'après-midi', 'nom', 'A1', 'The meeting is in the afternoon.', 'La réunion a lieu l''après-midi.', 'On dit in the afternoon et on Friday afternoon.', array['time']),
('evening', 'evening', 'evening', 'soirée', 'nom', 'A1', 'We usually eat at seven in the evening.', 'Nous mangeons généralement à sept heures du soir.', 'On dit in the evening, mais at night.', array['time']),
('week', 'week', 'week', 'semaine', 'nom', 'A1', 'The course lasts one week.', 'Le cours dure une semaine.', 'A week peut indiquer une durée ; per week exprime une fréquence.', array['time']),
('month', 'month', 'month', 'mois', 'nom', 'A1', 'My birthday is next month.', 'Mon anniversaire est le mois prochain.', 'Month est identique au singulier et au pluriel dans son orthographe de base.', array['time']),
('early', 'early', 'early', 'tôt, en avance', 'adverbe/adjectif', 'A1', 'The train arrived ten minutes early.', 'Le train est arrivé avec dix minutes d''avance.', 'Early est à la fois adjectif et adverbe ; opposite : late.', array['time']),
('late', 'late', 'late', 'tard, en retard', 'adverbe/adjectif', 'A1', 'Sorry, I''m late for class.', 'Désolé, je suis en retard en cours.', 'Be late for + événement ; arrive late décrit l''arrivée tardive.', array['time']),
('mother', 'mother', 'mother', 'mère', 'nom', 'A1', 'My mother lives near the sea.', 'Ma mère habite près de la mer.', 'Mum (BrE) et mom (AmE) sont plus familiers.', array['family']),
('father', 'father', 'father', 'père', 'nom', 'A1', 'His father works in a hospital.', 'Son père travaille dans un hôpital.', 'Dad est la forme familière courante.', array['family']),
('parents', 'parents', 'parents', 'parents', 'nom pluriel', 'A1', 'Her parents are visiting this week.', 'Ses parents lui rendent visite cette semaine.', 'Toujours pluriel en anglais ; parent au singulier signifie un parent.', array['family']),
('brother', 'brother', 'brother', 'frère', 'nom', 'A1', 'I have one older brother.', 'J''ai un frère aîné.', 'Older précise l''âge relatif ; elder est plus limité et plus formel.', array['family']),
('sister', 'sister', 'sister', 'sœur', 'nom', 'A1', 'My sister studies in Bristol.', 'Ma sœur étudie à Bristol.', 'Sister peut aussi désigner une religieuse selon le contexte.', array['family']),
('child', 'child', 'child', 'enfant', 'nom', 'A1', 'Each child has a name tag.', 'Chaque enfant a une étiquette avec son nom.', 'Pluriel irrégulier : children.', array['family']),
('husband', 'husband', 'husband', 'mari, époux', 'nom', 'A1', 'Her husband is a teacher.', 'Son mari est enseignant.', 'Spouse est un terme neutre et administratif.', array['family', 'relationships']),
('wife', 'wife', 'wife', 'épouse, femme', 'nom', 'A1', 'His wife is from Canada.', 'Sa femme est originaire du Canada.', 'Pluriel irrégulier : wives.', array['family', 'relationships']),
('friend', 'friend', 'friend', 'ami(e)', 'nom', 'A1', 'A friend from school called me.', 'Un ami de l''école m''a appelé.', 'A friend of mine signifie un de mes amis.', array['family', 'relationships']),
('neighbour', 'neighbour', 'neighbor', 'voisin(e)', 'nom', 'A1', 'Our neighbours have a small dog.', 'Nos voisins ont un petit chien.', 'Neighbour est l''orthographe britannique ; neighbor est américain.', array['family', 'relationships']),
('food', 'food', 'food', 'nourriture, aliments', 'nom indénombrable', 'A1', 'The food at this café is fresh.', 'La nourriture de ce café est fraîche.', 'Food est généralement indénombrable ; foods désigne des catégories variées.', array['food']),
('water', 'water', 'water', 'eau', 'nom indénombrable', 'A1', 'Could I have a glass of water?', 'Pourrais-je avoir un verre d''eau ?', 'Pour compter : a glass/bottle of water.', array['food', 'restaurant']),
('bread', 'bread', 'bread', 'pain', 'nom indénombrable', 'A1', 'Would you like some bread?', 'Voulez-vous du pain ?', 'Pour une unité : a loaf/slice of bread.', array['food']),
('rice', 'rice', 'rice', 'riz', 'nom indénombrable', 'A1', 'We serve rice with the vegetables.', 'Nous servons du riz avec les légumes.', 'Pas de pluriel en usage général ; a grain of rice pour une unité.', array['food']),
('chicken', 'chicken', 'chicken', 'poulet, poule', 'nom', 'A1', 'I''d like the chicken with rice.', 'Je voudrais le poulet avec du riz.', 'Le plat est indénombrable ; l''animal est dénombrable.', array['food', 'restaurant']),
('vegetable', 'vegetable', 'vegetable', 'légume', 'nom', 'A1', 'You should eat more vegetables.', 'Tu devrais manger plus de légumes.', 'Le pluriel vegetables est courant pour parler de légumes en général.', array['food', 'health']),
('hungry', 'hungry', 'hungry', 'avoir faim', 'adjectif', 'A1', 'The children are hungry after school.', 'Les enfants ont faim après l''école.', 'En anglais, on dit be hungry, pas have hungry.', array['food', 'health']),
('menu', 'menu', 'menu', 'menu, carte', 'nom', 'A1', 'Could we see the menu, please?', 'Pourrions-nous voir la carte, s''il vous plaît ?', 'Menu désigne généralement la carte du restaurant.', array['food', 'restaurant']),
('breakfast', 'breakfast', 'breakfast', 'petit-déjeuner', 'nom', 'A1', 'Breakfast is included in the room price.', 'Le petit-déjeuner est inclus dans le prix de la chambre.', 'Have breakfast s''emploie sans article.', array['food', 'time']),
('house', 'house', 'house', 'maison (bâtiment)', 'nom', 'A1', 'Their house has a blue door.', 'Leur maison a une porte bleue.', 'House désigne surtout le bâtiment ; home le foyer ou chez soi.', array['home']),
('apartment', 'apartment', 'apartment', 'appartement', 'nom', 'A1', 'They rent a small apartment downtown.', 'Ils louent un petit appartement en centre-ville.', 'Flat est plus courant en anglais britannique.', array['home']),
('room', 'room', 'room', 'pièce, chambre', 'nom', 'A1', 'There are three rooms upstairs.', 'Il y a trois pièces à l''étage.', 'Bedroom précise une chambre à coucher.', array['home']),
('kitchen', 'kitchen', 'kitchen', 'cuisine', 'nom', 'A1', 'The cups are in the kitchen.', 'Les tasses sont dans la cuisine.', 'Kitchen désigne la pièce ; cooking désigne l''activité.', array['home']),
('bathroom', 'bathroom', 'bathroom', 'salle de bains, toilettes', 'nom', 'A1', 'The bathroom is next to the bedroom.', 'La salle de bains est à côté de la chambre.', 'En Amérique du Nord, bathroom peut aussi désigner les toilettes publiques.', array['home']),
('bedroom', 'bedroom', 'bedroom', 'chambre à coucher', 'nom', 'A1', 'The bedroom gets the morning sun.', 'La chambre reçoit le soleil du matin.', 'Bedroom est un nom composé : bed + room.', array['home']),
('table', 'table', 'table', 'table', 'nom', 'A1', 'Please put the plates on the table.', 'Pose les assiettes sur la table, s''il te plaît.', 'Table désigne un meuble ; desk est un bureau de travail.', array['home']),
('chair', 'chair', 'chair', 'chaise', 'nom', 'A1', 'There is a chair by the window.', 'Il y a une chaise près de la fenêtre.', 'Chair peut aussi désigner un poste de président dans un comité.', array['home']),
('door', 'door', 'door', 'porte', 'nom', 'A1', 'Please close the door quietly.', 'Ferme la porte doucement, s''il te plaît.', 'Door désigne l''élément mobile ; doorway, l''ouverture.', array['home']),
('key', 'key', 'key', 'clé', 'nom', 'A1', 'I can''t find the key to the front door.', 'Je ne trouve pas la clé de la porte d''entrée.', 'Key to est la collocation courante pour la clé d''un lieu/objet.', array['home']),
('ticket', 'ticket', 'ticket', 'billet, ticket', 'nom', 'A1', 'I bought a return ticket to Oxford.', 'J''ai acheté un billet aller-retour pour Oxford.', 'Ticket s''emploie pour les transports et les événements.', array['travel']),
('passport', 'passport', 'passport', 'passeport', 'nom', 'A1', 'Keep your passport in a safe place.', 'Gardez votre passeport dans un endroit sûr.', 'Document de voyage ; travel document est plus générique.', array['travel']),
('train', 'train', 'train', 'train', 'nom', 'A1', 'The train leaves from platform four.', 'Le train part du quai numéro quatre.', 'On dit by train pour le moyen de transport.', array['travel', 'transport']),
('bus', 'bus', 'bus', 'bus', 'nom', 'A1', 'We take the bus to the city centre.', 'Nous prenons le bus pour le centre-ville.', 'Pluriel : buses ; on bus désigne le fait d''être à bord.', array['travel', 'transport']),
('station', 'station', 'station', 'gare, station', 'nom', 'A1', 'The station is opposite the museum.', 'La gare est en face du musée.', 'Train station précise une gare ferroviaire ; bus station, une gare routière.', array['travel', 'city']),
('airport', 'airport', 'airport', 'aéroport', 'nom', 'A1', 'We arrived at the airport two hours early.', 'Nous sommes arrivés à l''aéroport avec deux heures d''avance.', 'At the airport pour le lieu ; in the airport pour l''intérieur du bâtiment.', array['travel']),
('suitcase', 'suitcase', 'suitcase', 'valise', 'nom', 'A1', 'My suitcase is too heavy to carry.', 'Ma valise est trop lourde à porter.', 'Luggage est indénombrable ; suitcase est dénombrable.', array['travel']),
('leave', 'leave', 'leave', 'partir, quitter', 'verbe', 'A1', 'Our flight leaves at nine.', 'Notre vol part à neuf heures.', 'Leave a place signifie quitter un lieu ; leave for signifie partir pour.', array['travel', 'movement']),
('arrive', 'arrive', 'arrive', 'arriver', 'verbe', 'A1', 'The bus arrives in ten minutes.', 'Le bus arrive dans dix minutes.', 'Arrive in + ville/pays ; arrive at + lieu précis.', array['travel', 'movement']),
('map', 'map', 'map', 'carte (géographique)', 'nom', 'A1', 'Can you show me the map?', 'Peux-tu me montrer la carte ?', 'Map est une carte géographique ; menu une carte de restaurant.', array['travel', 'city']),
('street', 'street', 'street', 'rue', 'nom', 'A1', 'The café is on this street.', 'Le café se trouve dans cette rue.', 'Street est souvent abrégé en St dans les adresses.', array['city']),
('crosswalk', 'crosswalk', 'crosswalk', 'passage piéton', 'nom', 'A2', 'Use the crosswalk to cross the busy street.', 'Utilisez le passage piéton pour traverser la rue animée.', 'Pedestrian crossing est la variante courante en anglais britannique.', array['city', 'directions', 'travel']),
('turn-left', 'turn left', 'turn left', 'tourner à gauche', 'expression verbale', 'A1', 'Turn left at the traffic lights.', 'Tournez à gauche au feu.', 'Instruction courante pour indiquer un itinéraire.', array['city', 'directions']),
('turn-right', 'turn right', 'turn right', 'tourner à droite', 'expression verbale', 'A1', 'Turn right after the bridge.', 'Tournez à droite après le pont.', 'Opposé de turn left.', array['city', 'directions']),
('straight-ahead', 'straight ahead', 'straight ahead', 'tout droit', 'expression adverbiale', 'A1', 'Go straight ahead for two blocks.', 'Continuez tout droit pendant deux pâtés de maisons.', 'Ahead peut être suivi d''un repère avec of.', array['city', 'directions']),
('corner', 'corner', 'corner', 'coin, angle', 'nom', 'A1', 'There is a bakery on the corner.', 'Il y a une boulangerie au coin de la rue.', 'On the corner of + rue/lieu.', array['city']),
('traffic-lights', 'traffic lights', 'traffic lights', 'feux de circulation', 'nom pluriel', 'A1', 'Cross the road at the traffic lights.', 'Traversez la route au feu.', 'Traffic lights est pluriel en anglais britannique ; traffic light au singulier pour un feu.', array['city', 'travel']),
('near', 'near', 'near', 'près de', 'préposition/adverbe', 'A1', 'The hotel is near the station.', 'L''hôtel est près de la gare.', 'Near peut être préposition ou adverbe ; nearby est adjectif/adverbe.', array['city', 'directions']),
('far', 'far', 'far', 'loin', 'adverbe/adjectif', 'A1', 'Is the beach far from here?', 'La plage est-elle loin d''ici ?', 'Far from introduit le repère de distance.', array['city', 'directions']),
('bank', 'bank', 'bank', 'banque', 'nom', 'A1', 'The bank closes at five.', 'La banque ferme à cinq heures.', 'Bank peut aussi désigner la rive d''un cours d''eau.', array['city', 'services']),
('pharmacy', 'pharmacy', 'pharmacy', 'pharmacie', 'nom', 'A2', 'There is a pharmacy next to the clinic.', 'Il y a une pharmacie à côté de la clinique.', 'Chemist''s est courant en anglais britannique.', array['city', 'health']),
('learn', 'learn', 'learn', 'apprendre', 'verbe', 'A1', 'I learn new words every day.', 'J''apprends de nouveaux mots chaque jour.', 'Learn concerne l''acquisition ; teach signifie transmettre.', array['study']),
('teach', 'teach', 'teach', 'enseigner', 'verbe', 'A1', 'She teaches English at a local school.', 'Elle enseigne l''anglais dans une école du quartier.', 'Prétérit et participe passé : taught.', array['study', 'work']),
('lesson', 'lesson', 'lesson', 'leçon, cours', 'nom', 'A1', 'Our first lesson starts at nine.', 'Notre premier cours commence à neuf heures.', 'Lesson est une séance ou un contenu ; course un cursus.', array['study']),
('homework', 'homework', 'homework', 'devoirs', 'nom indénombrable', 'A1', 'I have a lot of homework tonight.', 'J''ai beaucoup de devoirs ce soir.', 'Homework est indénombrable : pas de homeworks.', array['study']),
('office', 'office', 'office', 'bureau (lieu de travail)', 'nom', 'A1', 'My office is on the second floor.', 'Mon bureau est au deuxième étage.', 'Office désigne un lieu ; desk, le meuble.', array['work']),
('meeting', 'meeting', 'meeting', 'réunion', 'nom', 'A2', 'The meeting begins in ten minutes.', 'La réunion commence dans dix minutes.', 'Have/attend a meeting sont des collocations courantes.', array['work']),
('colleague', 'colleague', 'colleague', 'collègue', 'nom', 'A2', 'A colleague helped me with the report.', 'Un collègue m''a aidé pour le rapport.', 'Workmate est plus familier et surtout britannique.', array['work']),
('job', 'job', 'job', 'emploi, travail', 'nom dénombrable', 'A1', 'She has a new job in a hotel.', 'Elle a un nouvel emploi dans un hôtel.', 'Job est un poste ; work est souvent indénombrable pour l''activité.', array['work']),
('computer', 'computer', 'computer', 'ordinateur', 'nom', 'A1', 'Please save the file on your computer.', 'Enregistre le fichier sur ton ordinateur, s''il te plaît.', 'Computer est le terme générique ; laptop désigne un portable.', array['work', 'technology']),
('email', 'email', 'email', 'courriel, e-mail', 'nom/verbe', 'A1', 'I sent you an email this morning.', 'Je t''ai envoyé un courriel ce matin.', 'Email peut aussi être employé comme verbe : email me.', array['work', 'communication']),
('doctor', 'doctor', 'doctor', 'médecin', 'nom', 'A1', 'You should see a doctor about that cough.', 'Tu devrais consulter un médecin pour cette toux.', 'See a doctor signifie consulter un médecin.', array['health']),
('nurse', 'nurse', 'nurse', 'infirmier, infirmière', 'nom', 'A1', 'The nurse will call your name.', 'L''infirmière va appeler votre nom.', 'Nurse désigne une profession de santé.', array['health']),
('appointment', 'appointment', 'appointment', 'rendez-vous', 'nom', 'A1', 'I have a dentist appointment at three.', 'J''ai rendez-vous chez le dentiste à trois heures.', 'Make/book an appointment signifie prendre rendez-vous.', array['health', 'time']),
('pain', 'pain', 'pain', 'douleur', 'nom', 'A1', 'I have a pain in my shoulder.', 'J''ai mal à l''épaule.', 'Have a pain in + partie du corps ; be in pain décrit un état.', array['health']),
('headache', 'headache', 'headache', 'mal de tête', 'nom', 'A1', 'She has a headache and needs some rest.', 'Elle a mal à la tête et a besoin de repos.', 'Have a headache ; headache est dénombrable.', array['health']),
('medicine', 'medicine', 'medicine', 'médicament, médecine', 'nom', 'A1', 'Take this medicine after lunch.', 'Prenez ce médicament après le déjeuner.', 'Medicine peut désigner un médicament ou la discipline médicale.', array['health']),
('tired', 'tired', 'tired', 'fatigué(e)', 'adjectif', 'A1', 'I feel tired after a long journey.', 'Je me sens fatiguée après un long voyage.', 'Be/feel tired ; tiring qualifie ce qui fatigue.', array['health', 'feelings']),
('healthy', 'healthy', 'healthy', 'en bonne santé, sain', 'adjectif', 'A1', 'A healthy breakfast gives you energy.', 'Un petit-déjeuner sain vous donne de l''énergie.', 'Healthy qualifie une personne ou une habitude ; health est le nom.', array['health', 'food']),
('exercise', 'exercise', 'exercise', 'faire de l''exercice, exercice', 'nom/verbe', 'A1', 'I exercise three times a week.', 'Je fais de l''exercice trois fois par semaine.', 'Exercise peut être dénombrable pour une activité précise.', array['health', 'sport']),
('sleep', 'sleep', 'sleep', 'dormir, sommeil', 'verbe/nom', 'A1', 'Young children need enough sleep.', 'Les jeunes enfants ont besoin de dormir suffisamment.', 'Go to sleep signifie s''endormir ; sleep well, bien dormir.', array['health', 'daily-routine']),
('weather', 'weather', 'weather', 'temps, météo', 'nom indénombrable', 'A1', 'The weather is warm and sunny today.', 'Il fait doux et ensoleillé aujourd''hui.', 'Weather est indénombrable ; what is the weather like? demande la météo.', array['weather']),
('sunny', 'sunny', 'sunny', 'ensoleillé', 'adjectif', 'A1', 'It will be sunny this afternoon.', 'Il fera soleil cet après-midi.', 'It is sunny est une tournure impersonnelle courante.', array['weather']),
('cloudy', 'cloudy', 'cloudy', 'nuageux', 'adjectif', 'A1', 'The sky is cloudy this morning.', 'Le ciel est nuageux ce matin.', 'Cloudy décrit le ciel ou le temps.', array['weather']),
('rain', 'rain', 'rain', 'pluie, pleuvoir', 'nom/verbe', 'A1', 'It often rains here in November.', 'Il pleut souvent ici en novembre.', 'It rains est impersonnel ; rain peut être dénombrable pour une averse.', array['weather']),
('windy', 'windy', 'windy', 'venteux', 'adjectif', 'A1', 'It is too windy for a picnic.', 'Il y a trop de vent pour un pique-nique.', 'Windy vient de wind + -y.', array['weather']),
('cold', 'cold', 'cold', 'froid', 'adjectif/nom', 'A1', 'It gets very cold at night.', 'Il fait très froid la nuit.', 'Be cold décrit la température ou une personne qui a froid.', array['weather', 'feelings']),
('hot', 'hot', 'hot', 'chaud', 'adjectif', 'A1', 'The soup is still hot.', 'La soupe est encore chaude.', 'Hot peut aussi signifier épicé ou populaire selon le contexte.', array['weather', 'food']),
('season', 'season', 'season', 'saison', 'nom', 'A1', 'Autumn is my favourite season.', 'L''automne est ma saison préférée.', 'Fall est le terme américain courant pour autumn.', array['weather', 'time']),
('tree', 'tree', 'tree', 'arbre', 'nom', 'A1', 'There is a tall tree in the garden.', 'Il y a un grand arbre dans le jardin.', 'Tree désigne l''arbre ; wood peut désigner le bois ou un petit bois.', array['environment', 'home']),
('river', 'river', 'river', 'rivière, fleuve', 'nom', 'A1', 'The town is built beside a river.', 'La ville est construite au bord d''une rivière.', 'River précède souvent le nom propre en anglais : the River Thames.', array['environment', 'travel']),
('think', 'think', 'think', 'penser, croire', 'verbe', 'A1', 'I think this is the right address.', 'Je pense que c''est la bonne adresse.', 'Think about signifie réfléchir à ; think of peut demander une opinion.', array['communication', 'opinions']),
('agree', 'agree', 'agree', 'être d''accord', 'verbe', 'A1', 'I agree with your suggestion.', 'Je suis d''accord avec ta proposition.', 'Agree with a person/idea ; agree on a subject.', array['communication', 'opinions']),
('maybe', 'maybe', 'maybe', 'peut-être', 'adverbe', 'A1', 'Maybe we can meet after work.', 'Peut-être pouvons-nous nous retrouver après le travail.', 'Maybe s''écrit en un mot ; may be est le modal may suivi de be.', array['communication']),
('because', 'because', 'because', 'parce que', 'conjonction', 'A1', 'We stayed inside because it was raining.', 'Nous sommes restés à l''intérieur parce qu''il pleuvait.', 'Because introduit une proposition ; because of un groupe nominal.', array['communication', 'connectors']),
('but', 'but', 'but', 'mais', 'conjonction', 'A1', 'The room is small but comfortable.', 'La pièce est petite mais confortable.', 'But relie des éléments en contraste ; however est plus formel.', array['communication', 'connectors']),
('so', 'so', 'so', 'donc, alors', 'conjonction/adverbe', 'A1', 'It was late, so we took a taxi.', 'Il était tard, alors nous avons pris un taxi.', 'So introduit souvent une conséquence ; so peut aussi intensifier un adjectif.', array['communication', 'connectors']),
('really', 'really', 'really', 'vraiment', 'adverbe', 'A1', 'I really like this song.', 'J''aime vraiment cette chanson.', 'Really peut intensifier un adjectif ou un verbe.', array['communication']),
('i-think', 'I think', 'i think', 'je pense que', 'expression', 'A1', 'I think we should leave now.', 'Je pense que nous devrions partir maintenant.', 'Formule courante pour introduire une opinion avec prudence.', array['communication', 'opinions']),
('for-example', 'for example', 'for example', 'par exemple', 'expression', 'A1', 'Some fruit, for example apples, is easy to carry.', 'Certains fruits, par exemple les pommes, sont faciles à transporter.', 'Introduit un exemple ; peut se placer au début ou au milieu.', array['communication', 'connectors']),
('in-my-opinion', 'in my opinion', 'in my opinion', 'à mon avis', 'expression', 'A2', 'In my opinion, the earlier train is better.', 'À mon avis, le train précédent est préférable.', 'Marque explicitement un point de vue personnel.', array['communication', 'opinions'])
on conflict (slug) do nothing;

with seed(collection_slug, item_slugs) as (values
    ('greetings-introductions', array['hello','good-morning','goodbye','please','thank-you','youre-welcome','nice-to-meet-you','whats-your-name','how-are-you','excuse-me']::text[]),
    ('daily-routine', array['wake-up','get-up','get-dressed','have-breakfast','go-to-work','come-home','cook','clean','relax','weekend']::text[]),
    ('time-numbers', array['today','tomorrow','yesterday','morning','afternoon','evening','week','month','early','late']::text[]),
    ('family-relations', array['mother','father','parents','brother','sister','child','husband','wife','friend','neighbour']::text[]),
    ('food-restaurant', array['food','water','bread','rice','chicken','vegetable','hungry','menu','breakfast','cook']::text[]),
    ('home-objects', array['house','apartment','room','kitchen','bathroom','bedroom','table','chair','door','key']::text[]),
    ('travel-transport', array['ticket','passport','train','bus','station','airport','suitcase','leave','arrive','map']::text[]),
    ('city-directions', array['street','crosswalk','turn-left','turn-right','straight-ahead','corner','traffic-lights','near','far','bank','pharmacy']::text[]),
    ('study-work', array['learn','teach','lesson','homework','office','meeting','colleague','job','computer','email']::text[]),
    ('health-wellbeing', array['doctor','nurse','appointment','pain','headache','medicine','tired','healthy','exercise','sleep']::text[]),
    ('weather-environment', array['weather','sunny','cloudy','rain','windy','cold','hot','season','tree','river']::text[]),
    ('communication', array['think','agree','maybe','because','but','so','really','i-think','for-example','in-my-opinion']::text[])
)
insert into public.vocabulary_collection_items (collection_slug, vocabulary_item_slug, position)
select seed.collection_slug, words.item_slug, words.position::integer
from seed
cross join lateral unnest(seed.item_slugs) with ordinality as words(item_slug, position)
on conflict (collection_slug, vocabulary_item_slug) do nothing;

insert into public.vocabulary_scenarios
    (slug, title, description, cefr_level, learning_objective, situation, useful_phrases)
values
('first-meeting', 'Faire connaissance', 'Saluer et échanger des informations personnelles simples.', 'A1', 'Se présenter et poser des questions simples.', 'Vous rencontrez une nouvelle personne lors d''un cours.', array['Nice to meet you.', 'Where are you from?', 'What do you do?']),
('daily-conversation', 'Parler de sa journée', 'Raconter sa routine et ses activités du moment.', 'A1', 'Décrire une journée dans l''ordre chronologique.', 'Vous racontez votre journée à un ami.', array['I usually...', 'After that...', 'How about you?']),
('restaurant-order', 'Commander au restaurant', 'Demander un menu et commander poliment.', 'A1', 'Commander un repas et demander l''addition.', 'Vous commandez dans un petit restaurant.', array['Could I see the menu?', 'I would like...', 'Could we have the bill?']),
('ask-directions', 'Demander son chemin', 'Comprendre et donner des indications simples.', 'A2', 'Trouver un lieu en ville.', 'Vous cherchez la gare dans une ville inconnue.', array['Excuse me, how do I get to...?', 'Turn left at...', 'Is it far from here?']),
('hotel-checkin', 'Réserver un hôtel', 'Confirmer une réservation et demander des services.', 'A2', 'Gérer l''arrivée et les besoins d''hébergement.', 'Vous arrivez à la réception de votre hôtel.', array['I have a reservation under...', 'Is breakfast included?', 'What time is checkout?']),
('travel-airport', 'À l''aéroport', 'Parler de billets, de bagages et d''horaires.', 'A2', 'S''orienter et répondre aux questions à l''aéroport.', 'Vous vous enregistrez avant un vol.', array['Where is the check-in desk?', 'Here is my passport.', 'What time does boarding start?']),
('shopping', 'Faire des achats', 'Demander un prix, une taille et une autre option.', 'A2', 'Acheter un article dans un magasin.', 'Vous cherchez un vêtement dans une boutique.', array['How much is this?', 'Do you have a smaller size?', 'Can I pay by card?']),
('work-meeting', 'Participer à une réunion', 'Exprimer une opinion et réagir avec tact.', 'A2', 'Présenter une idée et demander une clarification.', 'Vous participez à une courte réunion d''équipe.', array['In my opinion...', 'Could you explain that?', 'I agree with that point.'])
on conflict (slug) do nothing;

with seed(scenario_slug, item_slugs) as (values
    ('first-meeting', array['hello','nice-to-meet-you','whats-your-name','how-are-you','friend']::text[]),
    ('daily-conversation', array['wake-up','get-dressed','have-breakfast','go-to-work','come-home','relax','weekend']::text[]),
    ('restaurant-order', array['please','thank-you','menu','water','food','hungry','breakfast']::text[]),
    ('ask-directions', array['excuse-me','street','turn-left','turn-right','straight-ahead','corner','near','far','station','map']::text[]),
    ('hotel-checkin', array['hello','passport','suitcase','room','key','please','thank-you']::text[]),
    ('travel-airport', array['ticket','passport','airport','suitcase','station','arrive','leave','map']::text[]),
    ('shopping', array['please','thank-you','how-are-you','maybe','really']::text[]),
    ('work-meeting', array['meeting','colleague','think','agree','because','but','so','in-my-opinion','for-example']::text[])
)
insert into public.vocabulary_scenario_items (scenario_slug, vocabulary_item_slug, position)
select seed.scenario_slug, words.item_slug, words.position::integer
from seed
cross join lateral unnest(seed.item_slugs) with ordinality as words(item_slug, position)
on conflict (scenario_slug, vocabulary_item_slug) do nothing;

create or replace function public.record_vocabulary_review(
    p_user_id uuid,
    p_vocabulary_item_slug text,
    p_rating public.srs_rating,
    p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_progress public.vocabulary_user_progress%rowtype;
    v_existing public.vocabulary_reviews%rowtype;
    v_now timestamptz := now();
    v_next_repetitions integer;
    v_next_interval integer;
    v_next_ease numeric(4, 2);
    v_next_mastery integer;
    v_next_review_at timestamptz;
    v_inserted_id uuid;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    if not exists (
        select 1 from public.vocabulary_catalog_items
        where slug = p_vocabulary_item_slug and is_published
    ) then
        raise exception 'Vocabulary item not found' using errcode = 'P0002';
    end if;

    insert into public.vocabulary_user_progress (user_id, vocabulary_item_slug)
    values (p_user_id, p_vocabulary_item_slug)
    on conflict (user_id, vocabulary_item_slug) do nothing;
    select * into v_progress from public.vocabulary_user_progress
    where user_id = p_user_id and vocabulary_item_slug = p_vocabulary_item_slug
    for update;

    v_next_ease := greatest(1.30, least(3.00,
        v_progress.ease_factor + case p_rating
            when 'again' then -0.20
            when 'hard' then -0.15
            when 'easy' then 0.15
            else 0.00
        end
    ));
    if p_rating = 'again' then
        v_next_repetitions := 0;
        v_next_interval := 1;
        v_next_mastery := greatest(0, v_progress.mastery_level - 1);
    elsif p_rating = 'hard' then
        v_next_repetitions := v_progress.repetitions + 1;
        v_next_interval := greatest(1, ceil(greatest(1, v_progress.interval_days) * 1.20)::integer);
        v_next_mastery := least(5, v_progress.mastery_level + 1);
    elsif p_rating = 'good' then
        v_next_repetitions := v_progress.repetitions + 1;
        v_next_interval := case v_progress.repetitions
            when 0 then 1 when 1 then 6
            else greatest(1, round(greatest(1, v_progress.interval_days) * v_progress.ease_factor)::integer)
        end;
        v_next_mastery := least(5, v_progress.mastery_level + 1);
    else
        v_next_repetitions := v_progress.repetitions + 1;
        v_next_interval := greatest(2, ceil(greatest(1, v_progress.interval_days) * (v_progress.ease_factor + 0.30))::integer);
        v_next_mastery := least(5, v_progress.mastery_level + 2);
    end if;
    v_next_review_at := case when p_rating = 'again'
        then v_now + interval '10 minutes'
        else v_now + make_interval(days => v_next_interval)
    end;

    insert into public.vocabulary_reviews
        (user_id, vocabulary_item_slug, request_id, rating, is_correct, reviewed_at, next_review_at)
    values
        (p_user_id, p_vocabulary_item_slug, p_request_id, p_rating, p_rating <> 'again', v_now, v_next_review_at)
    on conflict (user_id, request_id) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
        select * into v_existing from public.vocabulary_reviews
        where user_id = p_user_id and request_id = p_request_id;
        return jsonb_build_object(
            'item_slug', v_existing.vocabulary_item_slug,
            'rating', v_existing.rating,
            'mastery_level', (select mastery_level from public.vocabulary_user_progress where user_id = p_user_id and vocabulary_item_slug = v_existing.vocabulary_item_slug),
            'next_review_at', v_existing.next_review_at,
            'duplicate', true
        );
    end if;

    update public.vocabulary_user_progress set
        repetitions = v_next_repetitions,
        interval_days = v_next_interval,
        ease_factor = v_next_ease,
        successes = successes + case when p_rating = 'again' then 0 else 1 end,
        failures = failures + case when p_rating = 'again' then 1 else 0 end,
        mastery_level = v_next_mastery,
        last_reviewed_at = v_now,
        next_review_at = v_next_review_at,
        updated_at = v_now
    where user_id = p_user_id and vocabulary_item_slug = p_vocabulary_item_slug;

    return jsonb_build_object(
        'item_slug', p_vocabulary_item_slug,
        'rating', p_rating,
        'mastery_level', v_next_mastery,
        'next_review_at', v_next_review_at,
        'duplicate', false
    );
end;
$$;

grant execute on function public.record_vocabulary_review(uuid, text, public.srs_rating, uuid) to authenticated;

create or replace function public.create_vocabulary_quiz(
    p_user_id uuid,
    p_vocabulary_item_slugs text[],
    p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_quiz_id uuid := gen_random_uuid();
    v_public_questions jsonb;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 3 then
        raise exception 'Invalid quiz questions' using errcode = '22023';
    end if;

    select jsonb_agg(question.value - array['answer', 'accepted_answers', 'explanation', 'item_slug'] order by (question.value ->> 'index')::integer)
    into v_public_questions
    from jsonb_array_elements(p_questions) as question(value);

    insert into public.vocabulary_quiz_sessions (id, user_id, vocabulary_item_slugs, questions)
    values (v_quiz_id, p_user_id, p_vocabulary_item_slugs, v_public_questions);

    insert into public.vocabulary_quiz_answer_keys
        (quiz_session_id, question_index, vocabulary_item_slug, correct_answer, accepted_answers, explanation)
    select
        v_quiz_id,
        (question.value ->> 'index')::integer,
        question.value ->> 'item_slug',
        question.value ->> 'answer',
        coalesce(array(select jsonb_array_elements_text(question.value -> 'accepted_answers')), array[question.value ->> 'answer']),
        question.value ->> 'explanation'
    from jsonb_array_elements(p_questions) as question(value);

    return jsonb_build_object(
        'id', v_quiz_id,
        'questions', v_public_questions,
        'answered_count', 0,
        'status', 'active',
        'score', null
    );
end;
$$;

create or replace function public.answer_vocabulary_quiz(
    p_user_id uuid,
    p_quiz_id uuid,
    p_question_index integer,
    p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_session public.vocabulary_quiz_sessions%rowtype;
    v_key public.vocabulary_quiz_answer_keys%rowtype;
    v_previous public.vocabulary_quiz_answers%rowtype;
    v_correct boolean;
    v_normalized text;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    if length(p_answer) < 1 or length(p_answer) > 300 then
        raise exception 'Invalid answer' using errcode = '22023';
    end if;

    select * into v_session from public.vocabulary_quiz_sessions
    where id = p_quiz_id and user_id = p_user_id for update;
    if not found then
        raise exception 'Quiz not found' using errcode = 'P0002';
    end if;
    if v_session.status <> 'active' then
        raise exception 'Quiz is not active' using errcode = '55000';
    end if;

    select * into v_key from public.vocabulary_quiz_answer_keys
    where quiz_session_id = p_quiz_id and question_index = p_question_index;
    if not found then
        raise exception 'Question not found' using errcode = 'P0002';
    end if;
    select * into v_previous from public.vocabulary_quiz_answers
    where quiz_session_id = p_quiz_id and question_index = p_question_index;
    if found then
        v_normalized := regexp_replace(lower(trim(p_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g');
        if v_normalized <> regexp_replace(lower(trim(v_previous.submitted_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g') then
            raise exception 'Question already answered' using errcode = '23505';
        end if;
        return jsonb_build_object(
            'question_index', p_question_index,
            'is_correct', v_previous.is_correct,
            'correct_answer', v_key.correct_answer,
            'explanation', v_key.explanation
        );
    end if;

    v_normalized := regexp_replace(lower(trim(p_answer)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g');
    v_correct := exists (
        select 1 from unnest(v_key.accepted_answers) as answer(value)
        where v_normalized = regexp_replace(lower(trim(answer.value)), '^[[:punct:][:space:]]+|[[:punct:][:space:]]+$', '', 'g')
    );

    insert into public.vocabulary_quiz_answers
        (quiz_session_id, user_id, question_index, vocabulary_item_slug, submitted_answer, is_correct)
    values
        (p_quiz_id, p_user_id, p_question_index, v_key.vocabulary_item_slug, p_answer, v_correct);
    update public.vocabulary_quiz_sessions set
        answered_count = answered_count + 1,
        correct_answers = correct_answers + case when v_correct then 1 else 0 end
    where id = p_quiz_id and user_id = p_user_id;

    return jsonb_build_object(
        'question_index', p_question_index,
        'is_correct', v_correct,
        'correct_answer', v_key.correct_answer,
        'explanation', v_key.explanation
    );
end;
$$;

create or replace function public.finish_vocabulary_quiz(p_user_id uuid, p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_session public.vocabulary_quiz_sessions%rowtype;
    v_score integer;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    select * into v_session from public.vocabulary_quiz_sessions
    where id = p_quiz_id and user_id = p_user_id for update;
    if not found then
        raise exception 'Quiz not found' using errcode = 'P0002';
    end if;
    if v_session.answered_count < jsonb_array_length(v_session.questions) then
        raise exception 'Quiz has unanswered questions' using errcode = '55000';
    end if;
    v_score := case when v_session.answered_count = 0 then 0
        else round(v_session.correct_answers * 100.0 / v_session.answered_count)::integer end;
    update public.vocabulary_quiz_sessions set
        status = 'completed',
        score = v_score,
        finished_at = coalesce(finished_at, now())
    where id = p_quiz_id and user_id = p_user_id;
    return jsonb_build_object(
        'id', p_quiz_id,
        'questions', v_session.questions,
        'answered_count', v_session.answered_count,
        'status', 'completed',
        'score', v_score
    );
end;
$$;

create or replace function public.consume_vocabulary_ai_request(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_request_count integer;
    v_usage_date date := (now() at time zone 'UTC')::date;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'Not authorized' using errcode = '42501';
    end if;
    insert into public.vocabulary_ai_daily_usage (user_id, usage_date, request_count)
    values (p_user_id, v_usage_date, 1)
    on conflict (user_id, usage_date) do update
        set request_count = public.vocabulary_ai_daily_usage.request_count + 1
        where public.vocabulary_ai_daily_usage.request_count < 20
    returning request_count into v_request_count;
    if v_request_count is null then
        raise exception 'Daily AI quota exceeded' using errcode = 'P0001';
    end if;
    return v_request_count;
end;
$$;

revoke all on function public.create_vocabulary_quiz(uuid, text[], jsonb) from public, anon;
revoke all on function public.answer_vocabulary_quiz(uuid, uuid, integer, text) from public, anon;
revoke all on function public.finish_vocabulary_quiz(uuid, uuid) from public, anon;
revoke all on function public.consume_vocabulary_ai_request(uuid) from public, anon;
grant execute on function public.create_vocabulary_quiz(uuid, text[], jsonb) to authenticated;
grant execute on function public.answer_vocabulary_quiz(uuid, uuid, integer, text) to authenticated;
grant execute on function public.finish_vocabulary_quiz(uuid, uuid) to authenticated;
grant execute on function public.consume_vocabulary_ai_request(uuid) to authenticated;