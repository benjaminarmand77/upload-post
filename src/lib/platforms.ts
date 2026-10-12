/**
 * Registry of the 22 supported platforms. Everything platform-related in the
 * marketing site, the dashboard and the API reads from this file.
 */
export type PlatformKey =
  | 'tiktok' | 'instagram' | 'youtube' | 'linkedin' | 'facebook' | 'x' | 'threads'
  | 'pinterest' | 'reddit' | 'bluesky' | 'google_business' | 'discord' | 'telegram'
  | 'slack' | 'mastodon' | 'nostr' | 'lemmy' | 'devto' | 'hashnode' | 'wordpress'
  | 'whop' | 'listmonk';

export type AuthKind = 'oauth' | 'credentials';

export interface CredentialField {
  key: string;
  label: { fr: string; en: string };
  type?: 'text' | 'password' | 'url';
  placeholder?: string;
  help?: { fr: string; en: string };
}

export interface Platform {
  key: PlatformKey;
  slug: string;            // URL slug (/platforms/<slug>)
  name: string;
  short?: string;
  icon: string;            // Font Awesome class or "svg:<key>"
  color: string;           // brand hex
  invertDark?: boolean;    // black logos that need inverting in dark mode
  auth: AuthKind;
  credentialFields?: CredentialField[];
  supports: { video: boolean; photos: boolean; text: boolean; document?: boolean; analytics: boolean; comments?: boolean; media?: boolean };
  textLimit: number;
  maxPhotos?: number;
  inFreePlan: boolean;
  home: { desc: { fr: string; en: string }; tags: { fr: string[]; en: string[] } };
  page: {
    title: { fr: string; en: string };
    subtitle: { fr: string; en: string };
    intro: { fr: string; en: string };
    features: { fr: { t: string; d: string }[]; en: { t: string; d: string }[] };
  };
}

const F = (fr: string, en: string) => ({ fr, en });

export const PLATFORMS: Platform[] = [
  {
    key: 'tiktok', slug: 'tiktok', name: 'TikTok', icon: 'fa-brands fa-tiktok', color: '#000000', invertDark: true, auth: 'oauth',
    supports: { video: true, photos: true, text: false, analytics: true, comments: true, media: true }, textLimit: 2200, maxPhotos: 35, inFreePlan: false,
    home: { desc: F('Partagez vos vidéos sur TikTok et atteignez des millions d\'utilisateurs. Parfait pour le contenu viral.', 'Share your videos on TikTok and reach millions of users. Perfect for viral content.'),
      tags: { fr: ['Vidéos courtes', 'Sons tendance', 'Défis viraux', 'Campagnes de hashtag'], en: ['Short videos', 'Trending sounds', 'Viral challenges', 'Hashtag campaigns'] } },
    page: { title: F('API TikTok pour publier des vidéos', 'TikTok Upload API'), subtitle: F('Vidéos, images et carrousels de photos', 'Videos, Images and Photo Carousels'),
      intro: F('Publiez des vidéos, des images et des carrousels sur TikTok par programmation. L\'API Content Posting simplifiée, sans revue d\'application.', 'Upload videos, images and carousels to TikTok programmatically. Simplified Content Posting API without complications.'),
      features: { fr: [
        { t: 'API d\'upload de vidéo TikTok', d: 'Téléchargez des vidéos directement sur TikTok avec notre API REST. Point de terminaison simple et documenté.' },
        { t: 'Upload d\'image TikTok', d: 'Publiez des images individuelles sur TikTok automatiquement via API.' },
        { t: 'Carrousel de photos / Diaporama', d: 'Créez des carrousels et des diaporamas avec plusieurs images par programmation.' },
        { t: 'Téléchargeur automatique TikTok', d: 'Automatisez les téléchargements avec des plannings et des files de publication.' },
        { t: 'Sons tendance', d: 'Ajoutez des sons populaires de la Commercial Music Library à vos publications TikTok.' },
        { t: 'API d\'analyse TikTok', d: 'Mesurez la performance, l\'engagement et l\'audience de vos vidéos.' } ],
        en: [
        { t: 'TikTok Video Upload API', d: 'Upload videos straight to TikTok with our REST API. One simple, documented endpoint.' },
        { t: 'TikTok Image Upload', d: 'Publish single images on TikTok automatically through the API.' },
        { t: 'Photo carousel / Slideshow', d: 'Create carousels and slideshows with several images programmatically.' },
        { t: 'TikTok Auto Uploader', d: 'Automate uploads with schedules and publishing queues.' },
        { t: 'Trending sounds', d: 'Add popular Commercial Music Library tracks to your TikTok posts.' },
        { t: 'TikTok Analytics API', d: 'Measure performance, engagement and audience of your videos.' } ] } },
  },
  {
    key: 'instagram', slug: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram', color: '#E4405F', auth: 'oauth',
    supports: { video: true, photos: true, text: false, analytics: true, comments: true, media: true }, textLimit: 2200, maxPhotos: 10, inFreePlan: true,
    home: { desc: F('Engagez votre audience Instagram avec des Reels, des Stories et des publications.', 'Engage with your Instagram audience through Reels, Stories, and posts.'),
      tags: { fr: ['Instagram Reels', 'Stories', 'Feed posts', 'Carrousels'], en: ['Instagram Reels', 'Stories', 'Feed posts', 'Carousels'] } },
    page: { title: F('API Instagram pour publier Reels, photos et carrousels', 'Instagram Upload API'), subtitle: F('Reels, Stories, photos et carrousels', 'Reels, Stories, photos and carousels'),
      intro: F('Publiez des Reels, des Stories, des photos et des carrousels mixtes sur Instagram via une seule API, avec collaborateurs, tags et premier commentaire.', 'Publish Reels, Stories, photos and mixed carousels on Instagram through one API, with collaborators, tags and first comment.'),
      features: { fr: [
        { t: 'API Reels Instagram', d: 'Publiez des Reels avec couverture personnalisée, partage au feed et Trial Reels.' },
        { t: 'Photos et carrousels', d: 'Jusqu\'à 10 images ou vidéos mélangées dans un même carrousel.' },
        { t: 'Stories', d: 'Publiez des Stories photo ou vidéo directement via l\'API.' },
        { t: 'Collaborateurs et tags', d: 'Taguez des utilisateurs, des collaborateurs et un lieu.' },
        { t: 'Premier commentaire', d: 'Ajoutez automatiquement un premier commentaire après publication.' },
        { t: 'Analytique et commentaires', d: 'Vues, portée, likes, commentaires, DM et réponses privées.' } ],
        en: [
        { t: 'Instagram Reels API', d: 'Publish Reels with custom cover, share to feed and Trial Reels.' },
        { t: 'Photos and carousels', d: 'Up to 10 mixed images and videos in a single carousel.' },
        { t: 'Stories', d: 'Publish photo or video Stories straight from the API.' },
        { t: 'Collaborators and tags', d: 'Tag users, collaborators and a location.' },
        { t: 'First comment', d: 'Automatically add a first comment right after publishing.' },
        { t: 'Analytics and comments', d: 'Views, reach, likes, comments, DMs and private replies.' } ] } },
  },
  {
    key: 'youtube', slug: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube', color: '#FF0000', auth: 'oauth',
    supports: { video: true, photos: false, text: false, analytics: true, comments: true, media: true }, textLimit: 5000, inFreePlan: true,
    home: { desc: F('Téléchargez du contenu long sur YouTube et développez votre chaîne avec des vidéos de qualité.', 'Upload long-form content to YouTube and grow your channel with quality videos.'),
      tags: { fr: ['Contenu long', 'Séries vidéo', 'Contenu éducatif', 'Monétisation'], en: ['Long-form content', 'Video series', 'Educational content', 'Monetization'] } },
    page: { title: F('API YouTube pour publier vidéos et Shorts', 'YouTube Upload API'), subtitle: F('Vidéos longues et Shorts', 'Long videos and Shorts'),
      intro: F('Téléchargez des vidéos et des Shorts sur YouTube avec titre, description, tags, miniature, visibilité et programmation, sans gérer l\'API Data v3 vous-même.', 'Upload videos and Shorts to YouTube with title, description, tags, thumbnail, privacy and scheduling, without running the Data API v3 yourself.'),
      features: { fr: [
        { t: 'Upload de vidéos', d: 'Upload résumable de fichiers jusqu\'à plusieurs Go avec reprise automatique.' },
        { t: 'Shorts', d: 'Les vidéos verticales de moins de 3 minutes sont publiées en Shorts.' },
        { t: 'Métadonnées complètes', d: 'Titre, description, tags, catégorie, langue, licence, miniature personnalisée.' },
        { t: 'Visibilité', d: 'Public, non répertorié ou privé, avec date de publication.' },
        { t: 'Conformité', d: 'Déclarations « pour enfants », contenu synthétique et placement de produit.' },
        { t: 'Analytique', d: 'Vues, abonnés, likes et commentaires par vidéo.' } ],
        en: [
        { t: 'Video upload', d: 'Resumable upload of multi-GB files with automatic retry.' },
        { t: 'Shorts', d: 'Vertical videos under 3 minutes are published as Shorts.' },
        { t: 'Full metadata', d: 'Title, description, tags, category, language, license, custom thumbnail.' },
        { t: 'Privacy', d: 'Public, unlisted or private, with publish date.' },
        { t: 'Compliance', d: 'Made-for-kids, synthetic media and paid placement declarations.' },
        { t: 'Analytics', d: 'Views, subscribers, likes and comments per video.' } ] } },
  },
  {
    key: 'linkedin', slug: 'linkedin', name: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', color: '#0A66C2', auth: 'oauth',
    supports: { video: true, photos: true, text: true, document: true, analytics: true, comments: true, media: true }, textLimit: 3000, maxPhotos: 20, inFreePlan: true,
    home: { desc: F('Partagez du contenu professionnel sur LinkedIn pour développer votre réseau.', 'Share professional content on LinkedIn to grow your network.'),
      tags: { fr: ['Contenu professionnel', 'Mises à jour business', 'Insights secteur', 'Croissance réseau'], en: ['Professional content', 'Business updates', 'Industry insights', 'Network growth'] } },
    page: { title: F('API LinkedIn pour publier sur profils et pages', 'LinkedIn Upload API'), subtitle: F('Texte, images, vidéos et documents', 'Text, images, videos and documents'),
      intro: F('Publiez des posts texte, image, vidéo et des documents PDF (carrousels) sur votre profil LinkedIn ou vos pages entreprise.', 'Publish text, image, video and PDF document (carousel) posts to your LinkedIn profile or company pages.'),
      features: { fr: [
        { t: 'Posts texte et liens', d: 'Publiez des mises à jour avec aperçu de lien.' },
        { t: 'Images et vidéos', d: 'Images multiples et vidéos natives.' },
        { t: 'Documents PDF', d: 'Carrousels PDF, PPT et DOC affichés en lecteur natif.' },
        { t: 'Pages entreprise', d: 'Publiez sur les pages dont vous êtes administrateur.' },
        { t: 'Visibilité', d: 'Public, connexions ou membres connectés.' },
        { t: 'Analytique de page', d: 'Impressions, clics et engagement des pages.' } ],
        en: [
        { t: 'Text and link posts', d: 'Publish updates with link preview cards.' },
        { t: 'Images and videos', d: 'Multiple images and native video.' },
        { t: 'PDF documents', d: 'PDF, PPT and DOC carousels shown in the native viewer.' },
        { t: 'Company pages', d: 'Post to the pages you administer.' },
        { t: 'Visibility', d: 'Public, connections or logged-in members.' },
        { t: 'Page analytics', d: 'Impressions, clicks and engagement for pages.' } ] } },
  },
  {
    key: 'facebook', slug: 'facebook', name: 'Facebook', icon: 'fa-brands fa-facebook', color: '#1877F2', auth: 'oauth',
    supports: { video: true, photos: true, text: true, analytics: true, comments: true, media: true }, textLimit: 63206, maxPhotos: 10, inFreePlan: true,
    home: { desc: F('Atteignez votre audience sur Facebook avec des publications, vidéos et stories.', 'Reach your audience on Facebook with posts, videos and stories.'),
      tags: { fr: ['Feed posts', 'Stories', 'Gestion de pages', 'Vidéo en direct'], en: ['Feed posts', 'Stories', 'Page management', 'Live video'] } },
    page: { title: F('API Facebook pour publier sur vos pages', 'Facebook Upload API'), subtitle: F('Posts, Reels, Stories et photos', 'Posts, Reels, Stories and photos'),
      intro: F('Publiez des Reels, des vidéos, des photos, des Stories et des posts texte sur vos pages Facebook, avec premier commentaire et programmation.', 'Publish Reels, videos, photos, Stories and text posts to your Facebook Pages, with first comment and scheduling.'),
      features: { fr: [
        { t: 'Reels et vidéos', d: 'Vidéos Reels ou classiques, en brouillon ou publiées.' },
        { t: 'Photos', d: 'Photos uniques ou albums.' },
        { t: 'Stories', d: 'Stories photo et vidéo.' },
        { t: 'Posts texte et liens', d: 'Mises à jour avec aperçu de lien.' },
        { t: 'Multi-pages', d: 'Choisissez la page cible pour chaque publication.' },
        { t: 'Commentaires', d: 'Listez, répondez et supprimez les commentaires.' } ],
        en: [
        { t: 'Reels and videos', d: 'Reels or classic videos, draft or published.' },
        { t: 'Photos', d: 'Single photos or albums.' },
        { t: 'Stories', d: 'Photo and video Stories.' },
        { t: 'Text and link posts', d: 'Updates with link preview.' },
        { t: 'Multiple pages', d: 'Pick the target page for every post.' },
        { t: 'Comments', d: 'List, reply to and delete comments.' } ] } },
  },
  {
    key: 'x', slug: 'x', name: 'X (Twitter)', short: 'X', icon: 'fa-brands fa-x-twitter', color: '#000000', invertDark: true, auth: 'oauth',
    supports: { video: true, photos: true, text: true, analytics: true, media: true }, textLimit: 280, maxPhotos: 4, inFreePlan: true,
    home: { desc: F('Partagez des actualités et participez à des conversations en temps réel sur X.', 'Share news and join real-time conversations on X.'),
      tags: { fr: ['Tweets', 'Mises à jour en temps réel', 'Engagement de la communauté', 'Suivi hashtags'], en: ['Tweets', 'Real-time updates', 'Community engagement', 'Hashtag tracking'] } },
    page: { title: F('API X (Twitter) pour publier tweets, threads et médias', 'X (Twitter) Upload API'), subtitle: F('Tweets, threads, images, vidéos et sondages', 'Tweets, threads, images, videos and polls'),
      intro: F('Publiez des tweets, des threads automatiques, des images, des vidéos et des sondages sur X sans gérer l\'upload chunké des médias.', 'Publish tweets, automatic threads, images, videos and polls on X without handling chunked media upload.'),
      features: { fr: [
        { t: 'Tweets et threads', d: 'Les textes de plus de 280 caractères deviennent un thread.' },
        { t: 'Images et vidéos', d: 'Jusqu\'à 4 images ou une vidéo par tweet.' },
        { t: 'Sondages', d: '2 à 4 options avec durée.' },
        { t: 'Réponses et citations', d: 'Répondez ou citez un tweet existant.' },
        { t: 'Communautés', d: 'Publiez dans une communauté X.' },
        { t: 'Paramètres de réponse', d: 'Qui peut répondre : tous, abonnés, mentionnés, vérifiés.' } ],
        en: [
        { t: 'Tweets and threads', d: 'Text over 280 characters becomes a thread.' },
        { t: 'Images and videos', d: 'Up to 4 images or one video per tweet.' },
        { t: 'Polls', d: '2 to 4 options with a duration.' },
        { t: 'Replies and quotes', d: 'Reply to or quote an existing tweet.' },
        { t: 'Communities', d: 'Post into an X community.' },
        { t: 'Reply settings', d: 'Who can reply: everyone, followers, mentioned, verified.' } ] } },
  },
  {
    key: 'threads', slug: 'threads', name: 'Threads', icon: 'fa-brands fa-threads', color: '#000000', invertDark: true, auth: 'oauth',
    supports: { video: true, photos: true, text: true, analytics: true, media: true }, textLimit: 500, maxPhotos: 20, inFreePlan: true,
    home: { desc: F('Publiez sur Threads pour des conversations texte et l\'engagement communautaire.', 'Post on Threads for text conversations and community engagement.'),
      tags: { fr: ['Posts texte', 'Réponses', 'Sujets tendance', 'Intégration Instagram'], en: ['Text posts', 'Replies', 'Trending topics', 'Instagram integration'] } },
    page: { title: F('API Threads pour publier texte, photos et vidéos', 'Threads Upload API'), subtitle: F('Texte, images, vidéos et carrousels', 'Text, images, videos and carousels'),
      intro: F('Publiez des posts texte, des images, des vidéos et des carrousels mixtes sur Threads, avec sujet (topic tag), premier commentaire et threads automatiques.', 'Publish text posts, images, videos and mixed carousels on Threads with topic tag, first comment and automatic threads.'),
      features: { fr: [
        { t: 'Posts texte', d: 'Les textes de plus de 500 caractères deviennent un thread.' },
        { t: 'Photos et vidéos', d: 'Jusqu\'à 20 médias, carrousels mixtes.' },
        { t: 'Topic tag', d: 'Un sujet par post pour la découverte.' },
        { t: 'Premier commentaire', d: 'Ajouté automatiquement après publication.' },
        { t: 'Analytique', d: 'Vues, likes, réponses et reposts.' },
        { t: 'Programmation', d: 'Planifiez ou mettez en file d\'attente.' } ],
        en: [
        { t: 'Text posts', d: 'Text over 500 characters becomes a thread.' },
        { t: 'Photos and videos', d: 'Up to 20 media items, mixed carousels.' },
        { t: 'Topic tag', d: 'One topic per post for discovery.' },
        { t: 'First comment', d: 'Added automatically after publishing.' },
        { t: 'Analytics', d: 'Views, likes, replies and reposts.' },
        { t: 'Scheduling', d: 'Schedule or queue your posts.' } ] } },
  },
  {
    key: 'pinterest', slug: 'pinterest', name: 'Pinterest', icon: 'fa-brands fa-pinterest', color: '#E60023', auth: 'oauth',
    supports: { video: true, photos: true, text: false, analytics: true, media: true }, textLimit: 500, maxPhotos: 5, inFreePlan: true,
    home: { desc: F('Partagez du contenu visuel sur Pinterest pour inspirer et générer du trafic.', 'Share visual content on Pinterest to inspire and drive traffic.'),
      tags: { fr: ['Épingles image & vidéo', 'Organisation des tableaux', 'Idea Pins', 'Planification de contenu'], en: ['Image & video pins', 'Board organization', 'Idea Pins', 'Content planning'] } },
    page: { title: F('API Pinterest pour créer des épingles', 'Pinterest Upload API'), subtitle: F('Épingles image, vidéo et carrousel', 'Image, video and carousel pins'),
      intro: F('Créez des épingles image, vidéo et carrousel sur vos tableaux Pinterest avec lien de destination, texte alternatif et couverture personnalisée.', 'Create image, video and carousel pins on your Pinterest boards with destination link, alt text and custom cover.'),
      features: { fr: [
        { t: 'Épingles image', d: 'Une image ou un carrousel jusqu\'à 5 images.' },
        { t: 'Épingles vidéo', d: 'Vidéos avec image de couverture choisie.' },
        { t: 'Tableaux', d: 'Listez et ciblez vos tableaux publics ou secrets.' },
        { t: 'Lien et alt text', d: 'Lien de destination et texte alternatif.' },
        { t: 'Analytique', d: 'Impressions, enregistrements, clics.' },
        { t: 'Programmation', d: 'Planifiez vos épingles.' } ],
        en: [
        { t: 'Image pins', d: 'One image or a carousel up to 5 images.' },
        { t: 'Video pins', d: 'Videos with a chosen cover image.' },
        { t: 'Boards', d: 'List and target public or secret boards.' },
        { t: 'Link and alt text', d: 'Destination link and alternative text.' },
        { t: 'Analytics', d: 'Impressions, saves, clicks.' },
        { t: 'Scheduling', d: 'Schedule your pins.' } ] } },
  },
  {
    key: 'reddit', slug: 'reddit', name: 'Reddit', icon: 'fa-brands fa-reddit-alien', color: '#FF4500', auth: 'oauth',
    supports: { video: true, photos: true, text: true, analytics: true, media: true }, textLimit: 40000, maxPhotos: 20, inFreePlan: true,
    home: { desc: F('Publiez du texte et des liens sur des subreddits, planifiez et gérez les flairs.', 'Post text and links on subreddits, schedule and manage flairs.'),
      tags: { fr: ['Publications texte & liens', 'Planification', 'Flair & NSFW', 'Engagement analytique'], en: ['Text & link posts', 'Scheduling', 'Flair & NSFW', 'Engagement analytics'] } },
    page: { title: F('API Reddit pour publier sur des subreddits', 'Reddit Upload API'), subtitle: F('Texte, liens, images et vidéos', 'Text, links, images and videos'),
      intro: F('Publiez des posts texte, lien, image et vidéo sur n\'importe quel subreddit, avec flair, premier commentaire et programmation.', 'Publish text, link, image and video posts to any subreddit, with flair, first comment and scheduling.'),
      features: { fr: [
        { t: 'Posts texte', d: 'Titre et corps Markdown.' },
        { t: 'Posts lien', d: 'Lien avec carte d\'aperçu.' },
        { t: 'Images et vidéos', d: 'Galeries et vidéos natives.' },
        { t: 'Flair', d: 'Appliquez un flair de post.' },
        { t: 'Premier commentaire', d: 'Avec images en ligne.' },
        { t: 'Analytique', d: 'Votes, commentaires et impressions.' } ],
        en: [
        { t: 'Text posts', d: 'Title and Markdown body.' },
        { t: 'Link posts', d: 'Link with preview card.' },
        { t: 'Images and videos', d: 'Galleries and native video.' },
        { t: 'Flair', d: 'Apply a post flair.' },
        { t: 'First comment', d: 'With inline images.' },
        { t: 'Analytics', d: 'Votes, comments and impressions.' } ] } },
  },
  {
    key: 'bluesky', slug: 'bluesky', name: 'Bluesky', icon: 'fa-brands fa-bluesky', color: '#1185FE', auth: 'credentials',
    credentialFields: [
      { key: 'handle', label: F('Identifiant (handle)', 'Handle'), placeholder: 'vous.bsky.social' },
      { key: 'app_password', label: F('Mot de passe d\'application', 'App password'), type: 'password', help: F('Créez-le dans Paramètres → Mots de passe d\'application.', 'Create it in Settings → App passwords.') },
    ],
    supports: { video: true, photos: true, text: true, analytics: true, media: true }, textLimit: 300, maxPhotos: 4, inFreePlan: true,
    home: { desc: F('Partagez des posts et images sur Bluesky, le réseau social décentralisé.', 'Share posts and images on Bluesky, the decentralized social network.'),
      tags: { fr: ['Posts texte', 'Posts image', 'Réseau décentralisé', 'Protocole ouvert'], en: ['Text posts', 'Image posts', 'Decentralized network', 'Open protocol'] } },
    page: { title: F('API Bluesky pour publier posts, images et vidéos', 'Bluesky Upload API'), subtitle: F('Texte, images, vidéos et threads', 'Text, images, videos and threads'),
      intro: F('Publiez sur Bluesky (AT Protocol) avec threads automatiques, images, vidéos, liens enrichis et réponses.', 'Publish on Bluesky (AT Protocol) with automatic threads, images, videos, rich link cards and replies.'),
      features: { fr: [
        { t: 'Posts texte', d: 'Au-delà de 300 caractères, un thread est créé.' },
        { t: 'Images', d: 'Jusqu\'à 4 images avec alt text.' },
        { t: 'Vidéos', d: 'Vidéos natives.' },
        { t: 'Cartes de lien', d: 'Aperçu externe pour vos liens.' },
        { t: 'Réponses', d: 'Répondez à un post existant.' },
        { t: 'Mot de passe d\'application', d: 'Aucune app développeur à créer.' } ],
        en: [
        { t: 'Text posts', d: 'Over 300 characters, a thread is created.' },
        { t: 'Images', d: 'Up to 4 images with alt text.' },
        { t: 'Videos', d: 'Native video.' },
        { t: 'Link cards', d: 'External preview for your links.' },
        { t: 'Replies', d: 'Reply to an existing post.' },
        { t: 'App password', d: 'No developer app required.' } ] } },
  },
  {
    key: 'google_business', slug: 'google-business', name: 'Google Business', icon: 'fa-brands fa-google', color: '#4285F4', auth: 'oauth',
    supports: { video: false, photos: true, text: true, analytics: false }, textLimit: 1500, maxPhotos: 1, inFreePlan: true,
    home: { desc: F('Publiez des actualités, événements et offres sur votre fiche Google Business Profile.', 'Publish updates, events and offers on your Google Business Profile.'),
      tags: { fr: ['Actualités', 'Événements', 'Offres', 'Boutons d\'action'], en: ['Updates', 'Events', 'Offers', 'Call-to-action buttons'] } },
    page: { title: F('API Google Business Profile', 'Google Business Profile API'), subtitle: F('Actualités, événements et offres', 'Updates, events and offers'),
      intro: F('Publiez des mises à jour, des événements et des offres avec codes promo et boutons d\'action sur vos fiches Google Business Profile.', 'Publish standard updates, event posts and offers with coupon codes and call-to-action buttons on your Google Business Profile listings.'),
      features: { fr: [
        { t: 'Actualités', d: 'Mises à jour standard avec photo.' },
        { t: 'Événements', d: 'Titre, dates et horaires.' },
        { t: 'Offres', d: 'Codes promo, conditions et lien.' },
        { t: 'Boutons', d: 'Réserver, Commander, Acheter, En savoir plus, S\'inscrire, Appeler.' },
        { t: 'Multi-fiches', d: 'Choisissez la fiche cible.' },
        { t: 'Programmation', d: 'Planifiez vos publications.' } ],
        en: [
        { t: 'Updates', d: 'Standard updates with photo.' },
        { t: 'Events', d: 'Title, dates and times.' },
        { t: 'Offers', d: 'Coupon codes, terms and link.' },
        { t: 'Buttons', d: 'Book, Order, Shop, Learn More, Sign Up, Call.' },
        { t: 'Multiple listings', d: 'Choose the target listing.' },
        { t: 'Scheduling', d: 'Schedule your posts.' } ] } },
  },
  {
    key: 'discord', slug: 'discord', name: 'Discord', icon: 'fa-brands fa-discord', color: '#5865F2', auth: 'credentials',
    credentialFields: [ { key: 'webhook_url', label: F('URL du webhook entrant', 'Incoming webhook URL'), type: 'url', placeholder: 'https://discord.com/api/webhooks/…', help: F('Paramètres du salon → Intégrations → Webhooks.', 'Channel settings → Integrations → Webhooks.') } ],
    supports: { video: true, photos: true, text: true, analytics: false }, textLimit: 2000, maxPhotos: 10, inFreePlan: true,
    home: { desc: F('Envoyez messages, photos et vidéos dans vos salons Discord via un webhook entrant.', 'Post messages, photos, and videos straight to your Discord channels through an incoming webhook.'),
      tags: { fr: ['Messages texte', 'Pièces jointes photo', 'Uploads vidéo', 'Webhooks de salon'], en: ['Text Messages', 'Photo Attachments', 'Video Uploads', 'Channel Webhooks'] } },
    page: { title: F('API Discord pour publier dans vos salons', 'Discord Upload API'), subtitle: F('Messages, photos et vidéos par webhook', 'Messages, photos and videos through a webhook'),
      intro: F('Collez l\'URL d\'un webhook entrant et publiez du texte, jusqu\'à 10 images ou une vidéo dans le salon Discord de votre choix.', 'Paste an incoming webhook URL and publish text, up to 10 images or a video in the Discord channel of your choice.'),
      features: { fr: [
        { t: 'Messages texte', d: 'Jusqu\'à 2 000 caractères avec Markdown.' },
        { t: 'Photos', d: 'Jusqu\'à 10 images par message.' },
        { t: 'Vidéos', d: 'Vidéos jointes jusqu\'à la limite du serveur.' },
        { t: 'Sans OAuth', d: 'Un webhook de salon suffit.' },
        { t: 'Multi-salons', d: 'Un profil par salon.' },
        { t: 'Programmation', d: 'Planifiez vos messages.' } ],
        en: [
        { t: 'Text messages', d: 'Up to 2,000 characters with Markdown.' },
        { t: 'Photos', d: 'Up to 10 images per message.' },
        { t: 'Videos', d: 'Attached videos up to the server limit.' },
        { t: 'No OAuth', d: 'A channel webhook is enough.' },
        { t: 'Multiple channels', d: 'One profile per channel.' },
        { t: 'Scheduling', d: 'Schedule your messages.' } ] } },
  },
  {
    key: 'telegram', slug: 'telegram', name: 'Telegram', icon: 'fa-brands fa-telegram', color: '#26A5E4', auth: 'credentials',
    credentialFields: [
      { key: 'bot_token', label: F('Token du bot', 'Bot token'), type: 'password', placeholder: '123456:ABC-DEF…', help: F('Créé avec @BotFather.', 'Created with @BotFather.') },
      { key: 'chat_id', label: F('Identifiant du chat ou du canal', 'Chat or channel ID'), placeholder: '@moncanal ou -1001234567890' },
    ],
    supports: { video: true, photos: true, text: true, analytics: false }, textLimit: 4096, maxPhotos: 10, inFreePlan: true,
    home: { desc: F('Envoyez messages, photos et vidéos dans vos canaux et groupes Telegram avec votre propre bot.', 'Send messages, photos, and videos to your Telegram channels and groups with your own bot.'),
      tags: { fr: ['Messages texte', 'Photos et albums', 'Uploads vidéo', 'Auth par token de bot'], en: ['Text Messages', 'Single & Album Photos', 'Video Uploads', 'Bot Token Auth'] } },
    page: { title: F('API Telegram pour publier dans vos canaux', 'Telegram Upload API'), subtitle: F('Messages, photos, albums et vidéos', 'Messages, photos, albums and videos'),
      intro: F('Connectez votre bot Telegram et publiez du texte, des photos, des albums et des vidéos dans vos canaux et groupes.', 'Connect your Telegram bot and publish text, photos, albums and videos in your channels and groups.'),
      features: { fr: [
        { t: 'Messages texte', d: 'Jusqu\'à 4 096 caractères, HTML ou Markdown.' },
        { t: 'Photos et albums', d: 'Photo unique ou album jusqu\'à 10 médias.' },
        { t: 'Vidéos', d: 'Vidéos natives avec légende.' },
        { t: 'Token de bot', d: 'Aucun OAuth : BotFather suffit.' },
        { t: 'Canaux et groupes', d: 'Un profil par destination.' },
        { t: 'Programmation', d: 'Planifiez vos envois.' } ],
        en: [
        { t: 'Text messages', d: 'Up to 4,096 characters, HTML or Markdown.' },
        { t: 'Photos and albums', d: 'Single photo or album up to 10 media.' },
        { t: 'Videos', d: 'Native videos with caption.' },
        { t: 'Bot token', d: 'No OAuth: BotFather is enough.' },
        { t: 'Channels and groups', d: 'One profile per destination.' },
        { t: 'Scheduling', d: 'Schedule your messages.' } ] } },
  },
  {
    key: 'slack', slug: 'slack', name: 'Slack', icon: 'fa-brands fa-slack', color: '#4A154B', auth: 'credentials',
    credentialFields: [ { key: 'webhook_url', label: F('URL du webhook entrant', 'Incoming webhook URL'), type: 'url', placeholder: 'https://hooks.slack.com/services/…' } ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 4000, inFreePlan: true,
    home: { desc: F('Publiez des messages texte dans n\'importe quel canal Slack via un webhook entrant.', 'Post text messages to any Slack channel through an Incoming Webhook URL.'),
      tags: { fr: ['Messages texte', 'Webhook entrant', 'Sans OAuth', 'Canaux'], en: ['Text messages', 'Incoming webhook', 'No OAuth', 'Channels'] } },
    page: { title: F('API Slack pour publier dans vos canaux', 'Slack Upload API'), subtitle: F('Messages texte par webhook', 'Text messages through a webhook'),
      intro: F('Collez l\'URL d\'un webhook entrant Slack et publiez des messages texte dans le canal de votre choix, à la demande ou programmés.', 'Paste a Slack Incoming Webhook URL and publish text messages in the channel of your choice, on demand or scheduled.'),
      features: { fr: [
        { t: 'Messages texte', d: 'Mise en forme mrkdwn de Slack.' },
        { t: 'Webhook entrant', d: 'Aucune app Slack à publier.' },
        { t: 'Canaux', d: 'Un profil par canal.' },
        { t: 'Programmation', d: 'Planifiez vos annonces.' },
        { t: 'Automatisation', d: 'n8n, Make, Zapier et agents IA.' },
        { t: 'Historique', d: 'Chaque envoi est journalisé.' } ],
        en: [
        { t: 'Text messages', d: 'Slack mrkdwn formatting.' },
        { t: 'Incoming webhook', d: 'No Slack app to publish.' },
        { t: 'Channels', d: 'One profile per channel.' },
        { t: 'Scheduling', d: 'Schedule your announcements.' },
        { t: 'Automation', d: 'n8n, Make, Zapier and AI agents.' },
        { t: 'History', d: 'Every message is logged.' } ] } },
  },
  {
    key: 'mastodon', slug: 'mastodon', name: 'Mastodon', icon: 'fa-brands fa-mastodon', color: '#6364FF', auth: 'credentials',
    credentialFields: [
      { key: 'instance_url', label: F('URL de l\'instance', 'Instance URL'), type: 'url', placeholder: 'https://mastodon.social' },
      { key: 'access_token', label: F('Jeton d\'accès', 'Access token'), type: 'password', help: F('Préférences → Développement → Nouvelle application (write:statuses, write:media).', 'Preferences → Development → New application (write:statuses, write:media).') },
    ],
    supports: { video: true, photos: true, text: true, analytics: false }, textLimit: 500, maxPhotos: 4, inFreePlan: true,
    home: { desc: F('Publiez texte, images et vidéos sur n\'importe quelle instance Mastodon.', 'Post text, images and video to any Mastodon instance.'),
      tags: { fr: ['Posts texte', 'Images et vidéos', 'Toute instance', 'Fédiverse'], en: ['Text posts', 'Images and video', 'Any instance', 'Fediverse'] } },
    page: { title: F('API Mastodon pour publier sur le fédiverse', 'Mastodon Upload API'), subtitle: F('Texte, images et vidéos sur toute instance', 'Text, images and video on any instance'),
      intro: F('Connectez n\'importe quelle instance Mastodon avec un jeton d\'accès et publiez des posts texte, des images et des vidéos.', 'Connect any Mastodon instance with an access token and publish text posts, images and videos.'),
      features: { fr: [
        { t: 'Posts texte', d: 'Jusqu\'à 500 caractères (selon l\'instance).' },
        { t: 'Images', d: 'Jusqu\'à 4 images avec description.' },
        { t: 'Vidéos', d: 'Vidéos natives.' },
        { t: 'Toute instance', d: 'mastodon.social, piaille.fr, votre serveur…' },
        { t: 'Visibilité', d: 'Public, non listé, abonnés.' },
        { t: 'Programmation', d: 'Planifiez vos posts.' } ],
        en: [
        { t: 'Text posts', d: 'Up to 500 characters (instance dependent).' },
        { t: 'Images', d: 'Up to 4 images with description.' },
        { t: 'Videos', d: 'Native videos.' },
        { t: 'Any instance', d: 'mastodon.social, your own server…' },
        { t: 'Visibility', d: 'Public, unlisted, followers.' },
        { t: 'Scheduling', d: 'Schedule your posts.' } ] } },
  },
  {
    key: 'nostr', slug: 'nostr', name: 'Nostr', icon: 'svg:nostr', color: '#8E30EB', auth: 'credentials',
    credentialFields: [
      { key: 'nsec', label: F('Clé privée (nsec)', 'Private key (nsec)'), type: 'password', placeholder: 'nsec1…' },
      { key: 'relays', label: F('Relais (séparés par des virgules)', 'Relays (comma separated)'), placeholder: 'wss://relay.damus.io, wss://nos.lol' },
    ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 10000, inFreePlan: true,
    home: { desc: F('Publiez des notes NIP-01 signées avec votre clé et diffusées sur vos relais.', 'Publish NIP-01 notes signed with your key and broadcast to your relays.'),
      tags: { fr: ['Notes kind:1', 'Signature nsec', 'Relais', 'Protocole ouvert'], en: ['kind:1 notes', 'nsec signing', 'Relays', 'Open protocol'] } },
    page: { title: F('API Nostr pour publier des notes', 'Nostr Upload API'), subtitle: F('Notes kind:1 signées et diffusées', 'Signed kind:1 notes broadcast to relays'),
      intro: F('Publiez des notes Nostr (NIP-01 kind:1) signées avec votre clé privée et diffusées sur les relais de votre choix.', 'Publish Nostr notes (NIP-01 kind:1) signed with your private key and broadcast to the relays you choose.'),
      features: { fr: [
        { t: 'Notes texte', d: 'Événements kind:1 conformes NIP-01.' },
        { t: 'Signature locale', d: 'Signées avec votre nsec, jamais partagée.' },
        { t: 'Relais multiples', d: 'Diffusion simultanée sur vos relais.' },
        { t: 'Sans OAuth', d: 'Clé et relais, c\'est tout.' },
        { t: 'Programmation', d: 'Planifiez vos notes.' },
        { t: 'Automatisation', d: 'n8n, Make et agents IA.' } ],
        en: [
        { t: 'Text notes', d: 'NIP-01 compliant kind:1 events.' },
        { t: 'Local signing', d: 'Signed with your nsec, never shared.' },
        { t: 'Multiple relays', d: 'Simultaneous broadcast to your relays.' },
        { t: 'No OAuth', d: 'Key and relays, that is all.' },
        { t: 'Scheduling', d: 'Schedule your notes.' },
        { t: 'Automation', d: 'n8n, Make and AI agents.' } ] } },
  },
  {
    key: 'lemmy', slug: 'lemmy', name: 'Lemmy', icon: 'svg:lemmy', color: '#00BC8C', auth: 'credentials',
    credentialFields: [
      { key: 'instance_url', label: F('URL de l\'instance', 'Instance URL'), type: 'url', placeholder: 'https://lemmy.world' },
      { key: 'username', label: F('Nom d\'utilisateur', 'Username') },
      { key: 'password', label: F('Mot de passe', 'Password'), type: 'password' },
      { key: 'community', label: F('Communauté', 'Community'), placeholder: 'technology' },
    ],
    supports: { video: false, photos: true, text: true, analytics: false }, textLimit: 10000, maxPhotos: 1, inFreePlan: true,
    home: { desc: F('Publiez des posts texte et des photos dans n\'importe quelle communauté Lemmy.', 'Publish text posts and photos to any Lemmy community.'),
      tags: { fr: ['Posts texte', 'Photos', 'Toute communauté', 'Fédiverse'], en: ['Text posts', 'Photos', 'Any community', 'Fediverse'] } },
    page: { title: F('API Lemmy pour publier dans vos communautés', 'Lemmy Upload API'), subtitle: F('Posts texte et photos', 'Text posts and photos'),
      intro: F('Connectez une instance Lemmy avec vos identifiants et publiez des posts texte et des photos dans la communauté de votre choix.', 'Connect a Lemmy instance with your credentials and publish text posts and photos to the community of your choice.'),
      features: { fr: [
        { t: 'Posts texte', d: 'Titre et corps Markdown.' },
        { t: 'Photos', d: 'Image envoyée sur pictrs.' },
        { t: 'Toute instance', d: 'lemmy.world, lemmy.ml, votre serveur…' },
        { t: 'Communautés', d: 'Une communauté par profil.' },
        { t: 'Programmation', d: 'Planifiez vos posts.' },
        { t: 'Sans OAuth', d: 'Identifiants classiques.' } ],
        en: [
        { t: 'Text posts', d: 'Title and Markdown body.' },
        { t: 'Photos', d: 'Image uploaded to pictrs.' },
        { t: 'Any instance', d: 'lemmy.world, lemmy.ml, your own server…' },
        { t: 'Communities', d: 'One community per profile.' },
        { t: 'Scheduling', d: 'Schedule your posts.' },
        { t: 'No OAuth', d: 'Plain credentials.' } ] } },
  },
  {
    key: 'devto', slug: 'devto', name: 'Dev.to', icon: 'fa-brands fa-dev', color: '#0A0A0A', invertDark: true, auth: 'credentials',
    credentialFields: [ { key: 'api_key', label: F('Clé API DEV', 'DEV API key'), type: 'password', help: F('Settings → Extensions → DEV Community API Keys.', 'Settings → Extensions → DEV Community API Keys.') } ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 100000, inFreePlan: true,
    home: { desc: F('Publiez des articles Markdown sur votre compte DEV Community.', 'Publish Markdown articles to your DEV Community account.'),
      tags: { fr: ['Articles Markdown', 'Tags', 'Brouillon ou publié', 'Clé API'], en: ['Markdown articles', 'Tags', 'Draft or published', 'API key'] } },
    page: { title: F('API Dev.to pour publier des articles', 'Dev.to Publishing API'), subtitle: F('Articles Markdown sur DEV Community', 'Markdown articles on DEV Community'),
      intro: F('Publiez des articles Markdown avec titre, tags, image de couverture et URL canonique sur Dev.to avec votre clé API.', 'Publish Markdown articles with title, tags, cover image and canonical URL on Dev.to with your API key.'),
      features: { fr: [
        { t: 'Articles Markdown', d: 'Corps Markdown complet avec front matter.' },
        { t: 'Tags', d: 'Jusqu\'à 4 tags par article.' },
        { t: 'Brouillon ou publié', d: 'Choisissez l\'état de publication.' },
        { t: 'URL canonique', d: 'Pour republier votre blog.' },
        { t: 'Programmation', d: 'Planifiez vos articles.' },
        { t: 'Sans OAuth', d: 'Une clé API suffit.' } ],
        en: [
        { t: 'Markdown articles', d: 'Full Markdown body with front matter.' },
        { t: 'Tags', d: 'Up to 4 tags per article.' },
        { t: 'Draft or published', d: 'Choose the publication state.' },
        { t: 'Canonical URL', d: 'Cross-post your blog.' },
        { t: 'Scheduling', d: 'Schedule your articles.' },
        { t: 'No OAuth', d: 'An API key is enough.' } ] } },
  },
  {
    key: 'hashnode', slug: 'hashnode', name: 'Hashnode', icon: 'fa-brands fa-hashnode', color: '#2962FF', auth: 'credentials',
    credentialFields: [
      { key: 'access_token', label: F('Personal Access Token', 'Personal Access Token'), type: 'password' },
      { key: 'publication_id', label: F('ID de publication', 'Publication ID') },
    ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 100000, inFreePlan: true,
    home: { desc: F('Publiez des articles Markdown sur votre publication Hashnode.', 'Publish Markdown blog posts to your Hashnode publication.'),
      tags: { fr: ['Articles Markdown', 'Publication', 'Tags', 'Token personnel'], en: ['Markdown posts', 'Publication', 'Tags', 'Personal token'] } },
    page: { title: F('API Hashnode pour publier des articles', 'Hashnode Publishing API'), subtitle: F('Articles Markdown sur votre publication', 'Markdown posts on your publication'),
      intro: F('Publiez des articles Markdown sur votre publication Hashnode avec un Personal Access Token et l\'ID de votre publication.', 'Publish Markdown posts to your Hashnode publication with a Personal Access Token and your publication ID.'),
      features: { fr: [
        { t: 'Articles Markdown', d: 'Titre, sous-titre et corps Markdown.' },
        { t: 'Tags', d: 'Tags Hashnode existants.' },
        { t: 'Image de couverture', d: 'URL de couverture.' },
        { t: 'Publication', d: 'Ciblez une publication.' },
        { t: 'Programmation', d: 'Planifiez vos articles.' },
        { t: 'Sans OAuth', d: 'Token personnel.' } ],
        en: [
        { t: 'Markdown posts', d: 'Title, subtitle and Markdown body.' },
        { t: 'Tags', d: 'Existing Hashnode tags.' },
        { t: 'Cover image', d: 'Cover URL.' },
        { t: 'Publication', d: 'Target a publication.' },
        { t: 'Scheduling', d: 'Schedule your posts.' },
        { t: 'No OAuth', d: 'Personal token.' } ] } },
  },
  {
    key: 'wordpress', slug: 'wordpress', name: 'WordPress', icon: 'fa-brands fa-wordpress', color: '#21759B', auth: 'credentials',
    credentialFields: [
      { key: 'site_url', label: F('URL du site', 'Site URL'), type: 'url', placeholder: 'https://monsite.com' },
      { key: 'username', label: F('Nom d\'utilisateur', 'Username') },
      { key: 'app_password', label: F('Mot de passe d\'application', 'Application password'), type: 'password', help: F('Utilisateurs → Profil → Mots de passe d\'application.', 'Users → Profile → Application passwords.') },
    ],
    supports: { video: true, photos: true, text: true, analytics: false }, textLimit: 100000, maxPhotos: 10, inFreePlan: true,
    home: { desc: F('Créez des articles avec texte, photos et vidéos sur WordPress auto-hébergé.', 'Create posts with text, photos and video on self-hosted WordPress.'),
      tags: { fr: ['Articles', 'Médias', 'Catégories', 'REST API'], en: ['Posts', 'Media', 'Categories', 'REST API'] } },
    page: { title: F('API WordPress pour publier des articles', 'WordPress Publishing API'), subtitle: F('Articles, images et vidéos sur votre site', 'Posts, images and videos on your site'),
      intro: F('Publiez des articles avec texte, images et vidéos sur votre WordPress auto-hébergé via l\'API REST et un mot de passe d\'application.', 'Publish posts with text, images and videos to your self-hosted WordPress through the REST API and an application password.'),
      features: { fr: [
        { t: 'Articles', d: 'Titre, contenu HTML, extrait.' },
        { t: 'Images', d: 'Envoyées dans la médiathèque et mises en avant.' },
        { t: 'Vidéos', d: 'Intégrées dans l\'article.' },
        { t: 'Catégories et étiquettes', d: 'Classez vos articles.' },
        { t: 'Brouillon ou publié', d: 'Choisissez l\'état.' },
        { t: 'Programmation', d: 'Planifiez vos articles.' } ],
        en: [
        { t: 'Posts', d: 'Title, HTML content, excerpt.' },
        { t: 'Images', d: 'Uploaded to the media library and set as featured.' },
        { t: 'Videos', d: 'Embedded in the post.' },
        { t: 'Categories and tags', d: 'Organise your posts.' },
        { t: 'Draft or published', d: 'Choose the state.' },
        { t: 'Scheduling', d: 'Schedule your posts.' } ] } },
  },
  {
    key: 'whop', slug: 'whop', name: 'Whop', icon: 'svg:whop', color: '#FF6243', auth: 'credentials',
    credentialFields: [
      { key: 'api_key', label: F('Clé API Company', 'Company API key'), type: 'password' },
      { key: 'experience_id', label: F('ID de l\'expérience forum', 'Forum experience ID'), placeholder: 'exp_…' },
    ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 10000, inFreePlan: true,
    home: { desc: F('Envoyez des posts texte dans une expérience forum Whop.', 'Send text posts to a Whop forum experience.'),
      tags: { fr: ['Posts forum', 'Communauté', 'Clé Company', 'Sans OAuth'], en: ['Forum posts', 'Community', 'Company key', 'No OAuth'] } },
    page: { title: F('API Whop pour publier dans vos forums', 'Whop Publishing API'), subtitle: F('Posts texte dans une expérience forum', 'Text posts in a forum experience'),
      intro: F('Publiez des posts texte dans l\'expérience forum de votre communauté Whop avec une clé API Company.', 'Publish text posts in your Whop community forum experience with a Company API key.'),
      features: { fr: [
        { t: 'Posts forum', d: 'Titre et contenu.' },
        { t: 'Communauté', d: 'Ciblez une expérience forum.' },
        { t: 'Programmation', d: 'Planifiez vos posts.' },
        { t: 'Sans OAuth', d: 'Clé API Company.' },
        { t: 'Automatisation', d: 'n8n, Make et agents IA.' },
        { t: 'Historique', d: 'Journal de chaque envoi.' } ],
        en: [
        { t: 'Forum posts', d: 'Title and content.' },
        { t: 'Community', d: 'Target a forum experience.' },
        { t: 'Scheduling', d: 'Schedule your posts.' },
        { t: 'No OAuth', d: 'Company API key.' },
        { t: 'Automation', d: 'n8n, Make and AI agents.' },
        { t: 'History', d: 'Log of every post.' } ] } },
  },
  {
    key: 'listmonk', slug: 'listmonk', name: 'Listmonk', icon: 'fa-solid fa-envelope', color: '#0055D4', auth: 'credentials',
    credentialFields: [
      { key: 'instance_url', label: F('URL de l\'instance', 'Instance URL'), type: 'url', placeholder: 'https://listmonk.example.com' },
      { key: 'api_user', label: F('Utilisateur API', 'API user') },
      { key: 'api_token', label: F('Jeton API', 'API token'), type: 'password' },
      { key: 'list_id', label: F('ID de la liste', 'List ID'), placeholder: '1' },
    ],
    supports: { video: false, photos: false, text: true, analytics: false }, textLimit: 100000, inFreePlan: true,
    home: { desc: F('Créez et envoyez des campagnes de newsletter à une liste Listmonk.', 'Create and dispatch email newsletter campaigns to a Listmonk list.'),
      tags: { fr: ['Newsletters', 'Campagnes', 'Listes', 'Auto-hébergé'], en: ['Newsletters', 'Campaigns', 'Lists', 'Self-hosted'] } },
    page: { title: F('API Listmonk pour envoyer des newsletters', 'Listmonk Newsletter API'), subtitle: F('Campagnes email vers vos listes', 'Email campaigns to your lists'),
      intro: F('Créez et envoyez des campagnes de newsletter à vos listes Listmonk depuis la même API que vos réseaux sociaux.', 'Create and dispatch newsletter campaigns to your Listmonk lists from the same API as your social networks.'),
      features: { fr: [
        { t: 'Campagnes', d: 'Sujet et corps HTML ou Markdown.' },
        { t: 'Listes', d: 'Ciblez une liste d\'abonnés.' },
        { t: 'Envoi immédiat', d: 'Créée puis lancée automatiquement.' },
        { t: 'Programmation', d: 'Planifiez vos envois.' },
        { t: 'Auto-hébergé', d: 'Votre instance, vos données.' },
        { t: 'Sans OAuth', d: 'Utilisateur et jeton API.' } ],
        en: [
        { t: 'Campaigns', d: 'Subject and HTML or Markdown body.' },
        { t: 'Lists', d: 'Target a subscriber list.' },
        { t: 'Immediate send', d: 'Created then started automatically.' },
        { t: 'Scheduling', d: 'Schedule your sends.' },
        { t: 'Self-hosted', d: 'Your instance, your data.' },
        { t: 'No OAuth', d: 'API user and token.' } ] } },
  },
];

export const PLATFORM_MAP: Record<PlatformKey, Platform> = Object.fromEntries(PLATFORMS.map((p) => [p.key, p])) as any;
export const platformBySlug = (slug: string) => PLATFORMS.find((p) => p.slug === slug);
export const VIDEO_PLATFORMS = PLATFORMS.filter((p) => p.supports.video).map((p) => p.key);
export const PHOTO_PLATFORMS = PLATFORMS.filter((p) => p.supports.photos).map((p) => p.key);
export const TEXT_PLATFORMS = PLATFORMS.filter((p) => p.supports.text).map((p) => p.key);
export const OAUTH_PLATFORMS = PLATFORMS.filter((p) => p.auth === 'oauth').map((p) => p.key);
/** The 12 platforms shown on the home "Supported platforms" grid */
export const HOME_PLATFORMS: PlatformKey[] = ['tiktok', 'instagram', 'youtube', 'linkedin', 'facebook', 'threads', 'x', 'pinterest', 'reddit', 'bluesky', 'discord', 'telegram'];
/** Order used in the hero icon strip and nav dropdown */
export const NAV_PLATFORMS: PlatformKey[] = ['tiktok', 'instagram', 'linkedin', 'youtube', 'facebook', 'x', 'threads', 'pinterest', 'reddit', 'bluesky', 'discord', 'telegram', 'slack', 'mastodon', 'nostr', 'lemmy', 'devto', 'hashnode', 'wordpress', 'whop', 'listmonk', 'google_business'];

/** Inline SVG for brands missing from Font Awesome */
export const CUSTOM_SVG: Record<string, string> = {
  nostr: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.9 8.7c-.3-2.4-2-4.3-4.3-4.7-1.4-.3-2.8.1-3.9.9-.6.4-1.2.4-1.8 0-1.1-.8-2.5-1.2-3.9-.9C3.9 4.3 2.4 6 2.1 8.2c-.4 3.1 1.8 5.8 4.8 6.1.5.1.9.5.9 1v3.1c0 .5.4.9.9.9h.3c.5 0 .9-.4.9-.9v-2.7c0-.6.4-1 1-1.1 2.9-.5 5.1-3 5.1-6 0-.1 0-.3-.1-.4.9.1 1.8.4 2.6 1 .4.3.5.8.3 1.3l-.9 2.3c-.2.5 0 1 .5 1.2.5.2 1 0 1.2-.5l.9-2.3c.5-1.4.1-2.9-1-3.8-.7-.6-1.6-.9-2.5-1-.5-.1-.9-.5-.9-1 0-.1 0-.3-.2-.4z"/></svg>',
  lemmy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5.2c-3.9 0-7.2 2.3-7.2 5.3 0 .4.1.9.2 1.3L2.4 10c-.4-.2-.8 0-1 .3-.2.4-.1.8.3 1l3.3 2.1c.9 2 3.3 3.5 6 3.8l-.9 1.9c-.2.4 0 .8.3 1 .4.2.8 0 1-.3l1.3-2.6c.1 0 .2 0 .3 0s.2 0 .3 0l1.3 2.6c.2.4.6.5 1 .3.4-.2.5-.6.3-1l-.9-1.9c2.7-.3 5.1-1.8 6-3.8l3.3-2.1c.4-.2.5-.7.3-1-.2-.4-.7-.5-1-.3l-2.6 1.8c.1-.4.2-.9.2-1.3 0-3-3.3-5.3-7.2-5.3zm-3 5.6c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm6 0c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm-3 3.4c.7 0 1.3.3 1.6.8.2.3.1.7-.2.9-.3.2-.7.1-.9-.2-.1-.2-.3-.2-.5-.2s-.4.1-.5.2c-.2.3-.6.4-.9.2-.3-.2-.4-.6-.2-.9.3-.5.9-.8 1.6-.8z"/></svg>',
  whop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 7.5h3.4l2.3 6.9 2.3-6.9h3.3l2.3 6.9 2.3-6.9H22l-4.6 9h-3.3L12 10.4l-2.1 6.1H6.6z"/></svg>',
};
