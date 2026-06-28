import heroFallbackUrl from './og-image.jpg';

export const BLACKLINE_CONFIG = {
  admin: {
    allowedEmails: ['rodolfoluiz09082020@gmail.com'],
    allowedUids: ['HLaZh9fIaPWjIkHgV9koGGyrEJx2']
  },
  business: {
    name: 'Blackline Barbearia',
    shortName: 'BLACKLINE',
    siteUrl: 'https://blackline-barbearia.vercel.app/',
    ogImage: 'https://blackline-barbearia.vercel.app/og-image.jpg',
    phoneDisplay: 'WhatsApp a configurar',
    whatsapp: '',
    address: 'Endereco comercial a configurar',
    hoursText: 'Segunda a sÃ¡bado, das 09h Ã s 20h',
    instagram: '#',
    googleReviewsUrl: '#',
    mapEmbed: 'about:blank'
  },
  assets: {
    heroVideo: 'https://videos.pexels.com/video-files/3996971/3996971-uhd_2560_1440_25fps.mp4',
    heroFallback: heroFallbackUrl,
    barberFallback: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=900&auto=format&fit=crop'
  },
  services: [
    { id: 'corte-degrade', name: 'Corte degradÃª', duration: '45 min', durationMinutes: 45, price: 35, description: 'Corte moderno com acabamento navalhado.' },
    { id: 'corte-social', name: 'Corte social', duration: '40 min', durationMinutes: 40, price: 30, description: 'Corte clÃ¡ssico, limpo e alinhado.' },
    { id: 'barba-completa', name: 'Barba completa', duration: '30 min', durationMinutes: 30, price: 25, description: 'Barba modelada com toalha quente e finalizaÃ§Ã£o.' },
    { id: 'corte-barba', name: 'Corte + barba', duration: '1h10', durationMinutes: 70, price: 55, description: 'Combo completo para renovar o visual.' },
    { id: 'sobrancelha', name: 'Sobrancelha', duration: '15 min', durationMinutes: 15, price: 15, description: 'Design simples para acabamento do rosto.' },
    { id: 'pigmentacao', name: 'PigmentaÃ§Ã£o', duration: '40 min', durationMinutes: 40, price: 45, description: 'PigmentaÃ§Ã£o capilar ou de barba com acabamento natural.' }
  ],
  barbers: [
    { id: 'rafael-lima', name: 'Rafael Lima', specialty: 'Especialista em degradÃª e navalhado', availableDays: 'Segunda a sÃ¡bado', availableWeekDays: [1, 2, 3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1618077360395-f3068be8e001?q=80&w=900&auto=format&fit=crop' },
    { id: 'marcos-silva', name: 'Marcos Silva', specialty: 'Barba, corte clÃ¡ssico e social', availableDays: 'TerÃ§a a sÃ¡bado', availableWeekDays: [2, 3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1582893561942-d61adcb2e534?q=80&w=900&auto=format&fit=crop' },
    { id: 'andre-costa', name: 'AndrÃ© Costa', specialty: 'Corte moderno, freestyle e pigmentaÃ§Ã£o', availableDays: 'Quarta a sÃ¡bado', availableWeekDays: [3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=900&auto=format&fit=crop' }
  ],
  sampleTestimonials: [
    { name: 'Lucas Andrade', text: 'Atendimento pontual, corte bem alinhado e ambiente acima do que eu esperava.', rating: 5 },
    { name: 'Henrique Moura', text: 'Fiz corte e barba. O acabamento na navalha ficou impecÃ¡vel.', rating: 5 },
    { name: 'Caio Martins', text: 'Barbeiros cuidadosos, horÃ¡rio respeitado e resultado muito profissional.', rating: 5 }
  ],
  schedule: {
    openDays: [1, 2, 3, 4, 5, 6],
    start: '09:00',
    end: '20:00',
    intervalMinutes: 30
  },
  storageKeys: {
    appointments: 'blackline:appointments:v2'
  }
};
