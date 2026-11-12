import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Neuron Tree',
    short_name: 'NeuronTree',
    description: 'Personal Second Brain & Inspiration Infinite Canvas',
    start_url: '/',
    display: 'standalone',
    background_color: '#070707',
    theme_color: '#070707',
    icons: [
      {
        src: '/leaf-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
