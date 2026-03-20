export default function manifest() {
  return {
    name: 'lifeOS',
    short_name: 'lifeOS',
    description: 'A self-hosted, local-first Life Operating System for tasks, notes, reviews, and reflection.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#1f6feb',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    share_target: {
      action: '/api/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'files',
            accept: [
              'application/pdf',
              'audio/*',
              'image/*',
              'text/*',
            ],
          },
        ],
      },
    },
  };
}
