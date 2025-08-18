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
      console.log('🔊 AudioContext creado');
    } catch (error) {
      console.warn('❌ AudioContext no disponible:', error);
    }
  }

  // Activar audio con gesto del usuario
  async initAudioWithUserGesture() {
    if (!this.audioContext) return false;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.createSoundGenerators();
      console.log('✅ Audio activado');
      return true;
    } catch (error) {
      console.error('❌ Error activando audio:', error);
      return false;
    }
  }

  // Verificar si el audio está listo
  isAudioReady() {
    return this.audioContext?.state === 'running' && this.soundGenerators.size > 0;
  }

  // Crear generadores de sonido optimizados
  createSoundGenerators() {
    if (!this.audioContext) return;

    // Configuraciones de sonidos
    const soundConfigs = {
      itemCreated: { 
        frequencies: [261.63, 329.63, 392], // Do-Mi-Sol ascendente
        duration: 0.2, 
        type: 'sine' 
      },
      itemDeleted: { 
        frequencies: [392, 329.63, 261.63], // Sol-Mi-Do descendente  
        duration: 0.15, 
        type: 'sawtooth' 
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
    console.log('👤 Rol configurado:', userRole);
  }

  // Verificar si puede escuchar notificaciones
  canListen() {
    return this.allowedRoles.includes(this.currentUserRole?.toLowerCase());
  }

  // Reproducir sonido
  playNotification(type = 'itemCreated') {
    if (!this.isAudioReady()) {
      console.warn('⚠️ Audio no activado');
      return;
    }

    const generator = this.soundGenerators.get(type);
    if (generator) {
      try {
        generator();
        console.log(`🔊 ${type}`);
      } catch (error) {
        console.error('❌ Error reproduciendo sonido:', error);
      }
    }
  }

}

// Exportar instancia singleton
export default new NotificationService();