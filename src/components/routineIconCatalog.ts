import type { AppIconName } from './Icon';

export type RoutineIconCategory = 'health' | 'activity' | 'home' | 'food' | 'time' | 'communication' | 'symbol';

export interface RoutineIconCatalogEntry {
  name: AppIconName;
  category: RoutineIconCategory;
  en: string;
  fr: string;
  keywords?: string;
}

export const routineIconCatalog: RoutineIconCatalogEntry[] = [
  { name: 'tooth', category: 'health', en: 'Tooth', fr: 'Dent', keywords: 'dental orthodontic dentaire orthodontie' },
  { name: 'medical', category: 'health', en: 'Medical', fr: 'Médical', keywords: 'medicine médicament soin care' },
  { name: 'medkit', category: 'health', en: 'First aid', fr: 'Premiers secours', keywords: 'health santé trousse' },
  { name: 'bandage', category: 'health', en: 'Bandage', fr: 'Pansement', keywords: 'wound blessure' },
  { name: 'heart', category: 'health', en: 'Heart', fr: 'Cœur', keywords: 'cardio love amour' },
  { name: 'pulse', category: 'health', en: 'Pulse', fr: 'Pouls', keywords: 'heart rythme cardio' },
  { name: 'body', category: 'health', en: 'Body', fr: 'Corps', keywords: 'person personne santé' },
  { name: 'eye', category: 'health', en: 'Eye', fr: 'Œil', keywords: 'vision vue' },
  { name: 'ear', category: 'health', en: 'Ear', fr: 'Oreille', keywords: 'hearing audition' },
  { name: 'glasses', category: 'health', en: 'Glasses', fr: 'Lunettes', keywords: 'vision vue' },
  { name: 'thermometer', category: 'health', en: 'Temperature', fr: 'Température', keywords: 'fever fièvre' },
  { name: 'fitness', category: 'activity', en: 'Fitness', fr: 'Exercice', keywords: 'sport exercise exercice' },
  { name: 'barbell', category: 'activity', en: 'Weights', fr: 'Haltères', keywords: 'gym musculation strength force' },
  { name: 'bicycle', category: 'activity', en: 'Cycling', fr: 'Vélo', keywords: 'bike bicyclette' },
  { name: 'walk', category: 'activity', en: 'Walking', fr: 'Marche', keywords: 'steps pas promenade' },
  { name: 'footsteps', category: 'activity', en: 'Steps', fr: 'Pas', keywords: 'walk marche' },
  { name: 'football', category: 'activity', en: 'Football', fr: 'Football', keywords: 'sport ball ballon' },
  { name: 'basketball', category: 'activity', en: 'Basketball', fr: 'Basket', keywords: 'sport ball ballon' },
  { name: 'tennis', category: 'activity', en: 'Tennis', fr: 'Tennis', keywords: 'sport racket raquette' },
  { name: 'game-controller', category: 'activity', en: 'Game', fr: 'Jeu', keywords: 'controller manette loisir' },
  { name: 'musical-notes', category: 'activity', en: 'Music', fr: 'Musique', keywords: 'song chanson instrument' },
  { name: 'book', category: 'activity', en: 'Reading', fr: 'Lecture', keywords: 'read livre' },
  { name: 'school', category: 'activity', en: 'Learning', fr: 'Apprentissage', keywords: 'study étude education éducation' },
  { name: 'trophy', category: 'activity', en: 'Goal', fr: 'Objectif', keywords: 'success réussite challenge' },
  { name: 'home', category: 'home', en: 'Home', fr: 'Maison', keywords: 'house domicile' },
  { name: 'bed', category: 'home', en: 'Sleep', fr: 'Sommeil', keywords: 'night nuit repos rest' },
  { name: 'shirt', category: 'home', en: 'Clothing', fr: 'Vêtements', keywords: 'dress habit' },
  { name: 'basket', category: 'home', en: 'Basket', fr: 'Panier', keywords: 'laundry linge rangement' },
  { name: 'cart', category: 'home', en: 'Shopping', fr: 'Courses', keywords: 'store magasin achat' },
  { name: 'car', category: 'home', en: 'Car', fr: 'Voiture', keywords: 'travel transport trajet' },
  { name: 'paw', category: 'home', en: 'Pet', fr: 'Animal', keywords: 'dog cat chien chat' },
  { name: 'flower', category: 'home', en: 'Plant', fr: 'Plante', keywords: 'garden jardin fleur' },
  { name: 'leaf', category: 'home', en: 'Nature', fr: 'Nature', keywords: 'plant plante ecology écologie' },
  { name: 'nutrition', category: 'food', en: 'Nutrition', fr: 'Nutrition', keywords: 'food alimentation fruit' },
  { name: 'water', category: 'food', en: 'Water', fr: 'Eau', keywords: 'drink boire hydration hydratation' },
  { name: 'restaurant', category: 'food', en: 'Meal', fr: 'Repas', keywords: 'eat manger cutlery couverts' },
  { name: 'fast-food', category: 'food', en: 'Food', fr: 'Alimentation', keywords: 'meal repas eat manger' },
  { name: 'cafe', category: 'food', en: 'Drink', fr: 'Boisson', keywords: 'coffee café tea thé' },
  { name: 'calendar', category: 'time', en: 'Calendar', fr: 'Calendrier', keywords: 'date schedule planning' },
  { name: 'today', category: 'time', en: 'Today', fr: 'Aujourd’hui', keywords: 'day jour calendar calendrier' },
  { name: 'time', category: 'time', en: 'Time', fr: 'Heure', keywords: 'clock horloge' },
  { name: 'alarm', category: 'time', en: 'Alarm', fr: 'Réveil', keywords: 'reminder rappel clock horloge' },
  { name: 'timer', category: 'time', en: 'Timer', fr: 'Minuteur', keywords: 'duration durée' },
  { name: 'stopwatch', category: 'time', en: 'Stopwatch', fr: 'Chronomètre', keywords: 'duration durée sport' },
  { name: 'hourglass', category: 'time', en: 'Waiting', fr: 'Attente', keywords: 'time temps sablier' },
  { name: 'sunny', category: 'time', en: 'Morning', fr: 'Matin', keywords: 'sun soleil day jour' },
  { name: 'moon', category: 'time', en: 'Evening', fr: 'Soir', keywords: 'night nuit sleep sommeil' },
  { name: 'notifications', category: 'communication', en: 'Reminder', fr: 'Rappel', keywords: 'bell cloche alerte alert' },
  { name: 'call', category: 'communication', en: 'Call', fr: 'Appel', keywords: 'phone téléphone' },
  { name: 'chat', category: 'communication', en: 'Message', fr: 'Message', keywords: 'conversation discussion' },
  { name: 'mail', category: 'communication', en: 'Mail', fr: 'Courrier', keywords: 'email message' },
  { name: 'paper-plane', category: 'communication', en: 'Send', fr: 'Envoyer', keywords: 'message envoi' },
  { name: 'megaphone', category: 'communication', en: 'Announcement', fr: 'Annonce', keywords: 'communication voice voix' },
  { name: 'people', category: 'communication', en: 'Group', fr: 'Groupe', keywords: 'family famille équipe team' },
  { name: 'person', category: 'communication', en: 'Person', fr: 'Personne', keywords: 'participant profile profil' },
  { name: 'sparkles', category: 'symbol', en: 'Sparkles', fr: 'Étincelles', keywords: 'magic magie special spécial' },
  { name: 'star', category: 'symbol', en: 'Star', fr: 'Étoile', keywords: 'favorite favori' },
  { name: 'check', category: 'symbol', en: 'Validated', fr: 'Validé', keywords: 'done terminé success réussite' },
  { name: 'flag', category: 'symbol', en: 'Flag', fr: 'Drapeau', keywords: 'goal objectif milestone étape' },
  { name: 'flame', category: 'symbol', en: 'Streak', fr: 'Série', keywords: 'fire feu motivation' },
  { name: 'gift', category: 'symbol', en: 'Reward', fr: 'Récompense', keywords: 'present cadeau' },
  { name: 'ribbon', category: 'symbol', en: 'Achievement', fr: 'Réussite', keywords: 'award prix' },
  { name: 'rocket', category: 'symbol', en: 'Progress', fr: 'Progrès', keywords: 'launch lancement' },
  { name: 'shield', category: 'symbol', en: 'Protection', fr: 'Protection', keywords: 'security sécurité' },
  { name: 'thumbs-up', category: 'symbol', en: 'Approval', fr: 'Approbation', keywords: 'yes oui like' },
  { name: 'bulb', category: 'symbol', en: 'Idea', fr: 'Idée', keywords: 'light lumière' },
  { name: 'color-palette', category: 'symbol', en: 'Creative', fr: 'Créatif', keywords: 'art couleur color' },
];

export const routineIconCategories: RoutineIconCategory[] = ['health', 'activity', 'home', 'food', 'time', 'communication', 'symbol'];
