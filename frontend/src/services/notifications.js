// Servicio de notificaciones con sonido optimizado
class NotificationService {
  constructor() {
    this.audioContext = null;
    this.soundGenerators = new Map();
    this.allowedRoles = ['cocineros', 'administradores'];
    this.currentUserRole = null;
    this.initAudioContext();
  }

  // Inicializar el contexto de audio
  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      // Audio no disponible - continuar sin audio
    }
  }

  // Activar audio con gesto del usuario
  async initAudioWithUserGesture() {
    if (!this.audioContext) return false;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      // Solo crear generadores si no existen
      if (this.soundGenerators.size === 0) {
        this.createSoundGenerators();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Verificar si el audio está listo
  isAudioReady() {
    return this.audioContext?.state === 'running' && this.soundGenerators.size > 0;
  }

  // Desactivar audio
  disableAudio() {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  // Crear generadores de sonido optimizados
  createSoundGenerators() {
    if (!this.audioContext) return;

    // Configuraciones de sonidos
    const soundConfigs = {
      itemCreated: { 
        frequencies: [523.25, 659.25, 783.99, 1046.50], // Campana de restaurante - Do-Mi-Sol-Do alta
        duration: 0.4, 
        type: 'sine',
        bellEffect: true
      },
      itemDeleted: { 
        frequencies: [261.63, 329.63, 392], // Do-Mi-Sol ascendente (sonido anterior de creación)
        duration: 0.2, 
        type: 'sine' 
      }
    };

    // Crear generadores
    Object.entries(soundConfigs).forEach(([key, config]) => {
      this.soundGenerators.set(key, () => this.playSequence(config));
    });
  }

  // Función optimizada para reproducir secuencias de sonido
  playSequence(config) {
    if (!this.audioContext) return;

    if (config.bellEffect) {
      // Efecto de campana de restaurante con reverberación
      this.playBellSound(config);
    } else {
      // Sonido normal secuencial
      this.playNormalSequence(config);
    }
  }

  // Efecto de campana con reverberación
  playBellSound(config) {
    const startTime = this.audioContext.currentTime;
    
    // Crear múltiples osciladores para efecto de campana
    config.frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Crear un filtro pasa-bajo para suavizar el sonido
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, startTime);
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Configurar la frecuencia
      oscillator.frequency.setValueAtTime(freq, startTime);
      oscillator.type = 'sine';
      
      // Envelope de campana - ataque rápido y decay largo
      const noteTime = startTime + (index * 0.1); // Notas más rápidas
      gainNode.gain.setValueAtTime(0, noteTime);
      gainNode.gain.linearRampToValueAtTime(0.4, noteTime + 0.01); // Ataque muy rápido
      gainNode.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.5); // Decay largo
      
      oscillator.start(noteTime);
      oscillator.stop(noteTime + 1.5);
    });
  }

  // Sonido normal secuencial
  playNormalSequence(config) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    config.frequencies.forEach((freq, index) => {
      const noteTime = this.audioContext.currentTime + (index * config.duration);
      
      oscillator.frequency.setValueAtTime(freq, noteTime);
      gainNode.gain.setValueAtTime(0, noteTime);
      gainNode.gain.linearRampToValueAtTime(0.3, noteTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteTime + config.duration - 0.05);
    });
    
    oscillator.type = config.type;
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + (config.frequencies.length * config.duration));
  }

  // Configurar rol del usuario
  setCurrentUserRole(userRole) {
    this.currentUserRole = userRole;
  }

  // Verificar si puede escuchar notificaciones
  canListen() {
    return this.allowedRoles.includes(this.currentUserRole?.toLowerCase());
  }

  // 🔊 Reproducir sonido (SIEMPRE ACTIVO - sin verificar localStorage)
  playNotification(type = 'itemCreated') {
    if (!this.isAudioReady()) {
      return;
    }

    const generator = this.soundGenerators.get(type);
    if (generator) {
      try {
        generator();
      } catch (error) {
        console.error('🚨 Error reproduciendo sonido:', error);
      }
    }
  }

}

// Exportar instancia singleton
export default new NotificationService();