export const BLACKLINE_CONFIG = {
  business: {
    name: 'Blackline Barbearia',
    shortName: 'BLACKLINE',
    whatsapp: '5581999999999',
    address: 'Av. Boa Viagem, 1250 - Boa Viagem, Recife - PE',
    hoursText: 'Segunda a sabado, das 09h as 20h',
    instagram: 'https://www.instagram.com/blacklinebarbearia',
    googleReviewsUrl: 'https://www.google.com/search?q=Blackline+Barbearia+Recife+avaliacoes',
    mapEmbed: 'https://www.google.com/maps?q=Av.%20Boa%20Viagem%201250%20Recife%20PE&output=embed'
  },
  assets: {
    heroVideo: 'https://videos.pexels.com/video-files/3996971/3996971-uhd_2560_1440_25fps.mp4',
    heroFallback: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1600&auto=format&fit=crop',
    barberFallback: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=900&auto=format&fit=crop'
  },
  services: [
    { id: 'corte-degrade', name: 'Corte degrade', duration: '45 min', durationMinutes: 45, price: 35, description: 'Corte moderno com acabamento navalhado.' },
    { id: 'corte-social', name: 'Corte social', duration: '40 min', durationMinutes: 40, price: 30, description: 'Corte classico, limpo e alinhado.' },
    { id: 'barba-completa', name: 'Barba completa', duration: '30 min', durationMinutes: 30, price: 25, description: 'Barba modelada com toalha quente e finalizacao.' },
    { id: 'corte-barba', name: 'Corte + barba', duration: '1h10', durationMinutes: 70, price: 55, description: 'Combo completo para renovar o visual.' },
    { id: 'sobrancelha', name: 'Sobrancelha', duration: '15 min', durationMinutes: 15, price: 15, description: 'Design simples para acabamento do rosto.' },
    { id: 'pigmentacao', name: 'Pigmentacao', duration: '40 min', durationMinutes: 40, price: 45, description: 'Pigmentacao capilar ou de barba com acabamento natural.' }
  ],
  barbers: [
    { id: 'rafael-lima', name: 'Rafael Lima', specialty: 'Especialista em degrade e navalhado', availableDays: 'Segunda a sabado', availableWeekDays: [1, 2, 3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1618077360395-f3068be8e001?q=80&w=900&auto=format&fit=crop' },
    { id: 'marcos-silva', name: 'Marcos Silva', specialty: 'Barba, corte classico e social', availableDays: 'Terca a sabado', availableWeekDays: [2, 3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1582893561942-d61adcb2e534?q=80&w=900&auto=format&fit=crop' },
    { id: 'andre-costa', name: 'Andre Costa', specialty: 'Corte moderno, freestyle e pigmentacao', availableDays: 'Quarta a sabado', availableWeekDays: [3, 4, 5, 6], unavailableDates: [], photo: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=900&auto=format&fit=crop' }
  ],
  sampleTestimonials: [
    { name: 'Lucas Andrade', text: 'Atendimento pontual, corte bem alinhado e ambiente acima do que eu esperava.', rating: 5 },
    { name: 'Henrique Moura', text: 'Fiz corte e barba. O acabamento na navalha ficou impecavel.', rating: 5 },
    { name: 'Caio Martins', text: 'Barbeiros cuidadosos, horario respeitado e resultado muito profissional.', rating: 5 }
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
