import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, User, School, Phone, Mail, CreditCard, Check, X, Clock, AlertCircle, Database, Settings, BarChart3, RefreshCw, Download, ArrowLeft } from 'lucide-react';

// =========== CONFIGURACIÓN Y TIPOS ===========

// CONTROL DE CIERRE DE VENTAS - Cambiar a false para reactivar las ventas
const VENTAS_CERRADAS = true;

interface RaffleNumber {
  id: number;
  number: number;
  status: 'available' | 'reserved' | 'sold';
  reservedAt?: Date;
  soldAt?: Date;
  purchaseId?: string;
}

interface Purchase {
  id: string;
  buyerName: string;
  studentName: string;
  division: string;
  course: string;
  email: string;
  phone: string;
  numbers: number[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  mercadoPagoPreferenceId?: string;
  mercadoPagoPaymentId?: string;
  createdAt: Date;
}

interface FormData {
  buyerName: string;
  studentName: string;
  division: string;
  course: string;
  email: string;
  phone: string;
}

// =========== HOOKS PERSONALIZADOS ===========

const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
    }
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue] as const;
};

// =========== SERVICIOS SIMULADOS ===========

const API_BASE = '/api';

const apiService = {
  // Números de rifa
  async getNumbers(): Promise<RaffleNumber[]> {
    try {
      // Agregar timestamp para evitar cache del navegador
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE}/numbers?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Error al cargar números: ${response.status}`);
      }
      const data = await response.json();
      console.log('Numbers loaded from API:', data.length, 'numbers');
      return data;
    } catch (error) {
      console.error('Error fetching numbers:', error);
      // Re-throw the error to handle it properly in the UI
      throw error;
    }
  },

  // Crear compra y reservar números
  async createPurchase(purchaseData: any): Promise<{ 
    success: boolean; 
    purchaseId?: string; 
    reservationId?: string;
    error?: string;
    unavailableNumbers?: number[];
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', response.status, data);
        // Retornar el error con la estructura esperada
        return {
          success: false,
          error: data.error || `Error al crear compra: ${response.status}`,
          unavailableNumbers: data.unavailableNumbers,
          message: data.message
        };
      }
      
      console.log('Purchase created:', data);
      return { ...data, success: true };
    } catch (error) {
      console.error('Error creating purchase:', error);
      throw error;
    }
  },

  // Crear preferencia de MercadoPago REAL
  async createMercadoPagoPreference(purchaseData: Partial<Purchase>): Promise<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }> {
    try {
      const response = await fetch(`${API_BASE}/preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchaseData.id,
          buyerName: purchaseData.buyerName,
          email: purchaseData.email,
          numbers: purchaseData.numbers,
          totalAmount: purchaseData.totalAmount
        })
      });
      
      if (!response.ok) {
        throw new Error('Error creating payment preference');
      }
      
      const data = await response.json();
      console.log('MercadoPago preference created:', data);
      return data;
    } catch (error) {
      console.error('Error creating MercadoPago preference:', error);
      throw error;
    }
  },

  // Confirmar pago
  async confirmPayment(purchaseId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Error al confirmar pago: ${response.status}`);
      }
      const data = await response.json();
      console.log('Payment confirmed:', data);
      return data;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  },

  // Cancelar pago
  async cancelPayment(purchaseId: string, reason?: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/payment/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, reason })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Error al cancelar pago: ${response.status}`);
      }
      const data = await response.json();
      console.log('Payment cancelled:', data);
      return data;
    } catch (error) {
      console.error('Error cancelling payment:', error);
      throw error;
    }
  },
  
  // Cancelar compra/reserva manualmente
  async cancelPurchase(purchaseId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE}/purchase/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId })
      });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', response.status, errorData);
        throw new Error(`Error al cancelar compra: ${response.status}`);
      }
      const data = await response.json();
      console.log('Purchase cancelled:', data);
      return data;
    } catch (error) {
      console.error('Error cancelling purchase:', error);
      throw error;
    }
  },

  // Verificar disponibilidad de números
  async verifyAvailability(numbers: number[]): Promise<{ available: boolean; unavailableNumbers: number[] }> {
    try {
      const response = await fetch(`${API_BASE}/numbers/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: Array.from(numbers) })
      });
      
      if (!response.ok) {
        throw new Error('Error al verificar disponibilidad');
      }
      
      const data = await response.json();
      return {
        available: data.available,
        unavailableNumbers: data.unavailableNumbers || []
      };
    } catch (error) {
      console.error('Error verifying availability:', error);
      return { available: true, unavailableNumbers: [] }; // Asumir disponible en caso de error
    }
  },
  
  // Verificar estado de pago
  async checkPaymentStatus(paymentId: string): Promise<{ status: string; paymentMethod?: string }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      status: 'approved',
      paymentMethod: 'credit_card'
    };
  }
};

// =========== CONTEXTO DE ESTADO GLOBAL ===========

interface RaffleConfig {
  id: number | null;
  title: string;
  description: string;
  totalNumbers: number;
  pricePerNumber: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

const useStore = () => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig | null>(null);
  
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const loadNumbers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading raffle config from API...');
      // Cargar configuración de la rifa
      const configResponse = await fetch(`/api/raffle/config?t=${Date.now()}`);
      if (configResponse.ok) {
        const config = await configResponse.json();
        console.log('Raffle config loaded:', config);
        setRaffleConfig(config);
      }
      
      console.log('Loading numbers from API...');
      const numbersData = await apiService.getNumbers();
      console.log(`Loaded ${numbersData.length} numbers`);
      const soldCount = numbersData.filter(n => n.status === 'sold').length;
      console.log(`Sold numbers: ${soldCount}`);
      setNumbers(numbersData);
    } catch (err) {
      setError('Error cargando números de rifa. Por favor recarga la página.');
      console.error('Error loading numbers:', err);
      // Don't set empty numbers on error to preserve existing data
    } finally {
      setLoading(false);
    }
  }, []);

  const getNumberStatus = useCallback((number: number) => {
    const numberData = numbers.find(n => n.number === number);
    if (!numberData) return 'available';
    
    if (selectedNumbers.has(number)) return 'selected';
    return numberData.status;
  }, [numbers, selectedNumbers]);

  const toggleNumber = useCallback((number: number) => {
    const status = getNumberStatus(number);
    if (status === 'sold' || status === 'reserved') return;

    setSelectedNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(number)) {
        newSet.delete(number);
      } else {
        newSet.add(number);
      }
      return newSet;
    });
  }, [getNumberStatus]);

  return {
    selectedNumbers,
    setSelectedNumbers,
    numbers,
    loading,
    setLoading,
    error,
    setError,
    purchases,
    loadNumbers,
    getNumberStatus,
    toggleNumber,
    raffleConfig
  };
};

// =========== COMPONENTES ===========

// Component definitions moved outside to prevent re-creation on each render
interface PersonalDataFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<'selection' | 'form' | 'payment' | 'confirmation'>>;
  handleFormSubmit: () => void;
  selectedNumbers: Set<number>;
  setSelectedNumbers: React.Dispatch<React.SetStateAction<Set<number>>>;
  PRICE_PER_NUMBER: number;
  loading: boolean;
}

// PersonalDataForm component moved outside RifasApp to prevent re-creation
const PersonalDataForm: React.FC<PersonalDataFormProps> = ({ 
  formData, 
  setFormData, 
  setCurrentStep, 
  handleFormSubmit, 
  selectedNumbers, 
  setSelectedNumbers,
  PRICE_PER_NUMBER,
  loading 
}) => {
  const validateForm = () => {
    const { buyerName, studentName, division, course, email } = formData;
    return buyerName.trim() && studentName.trim() && division.trim() && course.trim() && email.trim();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <User className="mr-2" />
          Datos Personales
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCurrentStep('selection');
              // No cancelar reserva aquí, solo volver atrás
            }}
            className="text-blue-500 hover:text-blue-700 flex items-center px-3 py-1 rounded-lg hover:bg-blue-50"
          >
            <ArrowLeft className="mr-1" size={16} />
            Volver
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentStep('selection');
              setSelectedNumbers(new Set());
              setFormData({
                buyerName: '',
                studentName: '',
                division: '',
                course: '',
                email: '',
                phone: ''
              });
            }}
            className="text-red-500 hover:text-red-700 flex items-center px-3 py-1 rounded-lg hover:bg-red-50"
            disabled={loading}
          >
            <X className="mr-1" size={16} />
            Cancelar
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre completo del comprador *
            </label>
            <input
              type="text"
              value={formData.buyerName}
              onChange={(e) => setFormData(prev => ({...prev, buyerName: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Ej: María González"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <School className="mr-1" size={16} />
              Nombre del hijo/a *
            </label>
            <input
              type="text"
              value={formData.studentName}
              onChange={(e) => setFormData(prev => ({...prev, studentName: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Ej: Juan González"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              División *
            </label>
            <input
              type="text"
              value={formData.division}
              onChange={(e) => setFormData(prev => ({...prev, division: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Ej: A"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Curso *
            </label>
            <input
              type="text"
              value={formData.course}
              onChange={(e) => setFormData(prev => ({...prev, course: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="Ej: 5to"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Mail className="mr-1" size={16} />
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="ejemplo@gmail.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Phone className="mr-1" size={16} />
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder="11 1234 5678"
            />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-gray-800 mb-3">Resumen de Compra:</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Números seleccionados:</span>
              <span className="font-medium text-gray-800">{selectedNumbers.size}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Precio por número:</span>
              <span className="font-medium text-gray-800">${PRICE_PER_NUMBER.toLocaleString('es-AR')}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span className="text-gray-800">Total:</span>
              <span className="text-green-600">${(selectedNumbers.size * PRICE_PER_NUMBER).toLocaleString('es-AR')}</span>
            </div>
            
            <div className="mt-3 max-h-20 overflow-y-auto">
              <p className="text-xs text-gray-600 mb-1">Números: {Array.from(selectedNumbers).sort((a, b) => a - b).join(', ')}</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!validateForm() || loading}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-lg font-bold hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <RefreshCw className="animate-spin mr-2" size={16} />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="mr-2" />
              Proceder al Pago
            </>
          )}
        </button>
      </form>
    </div>
  );
};

const RifasApp = () => {
  const {
    selectedNumbers,
    setSelectedNumbers,
    numbers,
    loading,
    setLoading,
    error,
    setError,
    purchases,
    loadNumbers,
    getNumberStatus,
    toggleNumber,
    raffleConfig
  } = useStore();

  const [currentStep, setCurrentStep] = useState<'selection' | 'form' | 'payment' | 'confirmation'>('selection');
  const [currentView, setCurrentView] = useState<'app' | 'admin'>('app');
  const [formData, setFormData] = useState<FormData>({
    buyerName: '',
    studentName: '',
    division: '',
    course: '',
    email: '',
    phone: ''
  });

  const [currentPurchase, setCurrentPurchase] = useState<Purchase | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'approved' | 'rejected'>('pending');
  const [reservationTimer, setReservationTimer] = useState<number>(0);

  // Usar valores dinámicos de la BD o valores por defecto
  const PRICE_PER_NUMBER = raffleConfig?.pricePerNumber || 1000;
  const TOTAL_NUMBERS = raffleConfig?.totalNumbers || 1500;
  const RESERVATION_TIMEOUT = 15 * 60; // 15 minutos en segundos

  // Cargar números al montar el componente y actualizar periódicamente
  useEffect(() => {
    loadNumbers();
    
    // MEJORADO: Actualizar números cada 10 segundos para mejor sincronización
    const interval = setInterval(() => {
      console.log('Auto-refreshing numbers...');
      loadNumbers();
      
      // Si hay números seleccionados, verificar si siguen disponibles
      if (selectedNumbers.size > 0 && currentStep === 'selection') {
        const unavailable = Array.from(selectedNumbers).filter(num => {
          const status = getNumberStatus(num);
          return status === 'sold' || status === 'reserved';
        });
        
        if (unavailable.length > 0) {
          // Alertar al usuario que algunos números ya no están disponibles
          setError(`¡Atención! Los números ${unavailable.join(', ')} ya fueron reservados por otro usuario.`);
          // Deseleccionar números no disponibles
          setSelectedNumbers(prev => {
            const newSet = new Set(prev);
            unavailable.forEach(num => newSet.delete(num));
            return newSet;
          });
        }
      }
    }, 10000); // Reducido de 30s a 10s
    
    return () => clearInterval(interval);
  }, [loadNumbers, selectedNumbers, currentStep, getNumberStatus]);

  // Manejar retorno desde MercadoPago
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const purchaseId = urlParams.get('purchase');
    const paymentId = urlParams.get('payment_id');
    
    if (paymentStatus && purchaseId) {
      console.log('Returning from MercadoPago:', { paymentStatus, purchaseId, paymentId });
      
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Procesar según el estado
      if (paymentStatus === 'success') {
        setPaymentStatus('approved');
        setCurrentStep('confirmation');
        // Limpiar selección
        setSelectedNumbers(new Set());
        // Recargar números para ver el estado actualizado
        loadNumbers();
      } else if (paymentStatus === 'failure') {
        setPaymentStatus('rejected');
        setCurrentStep('payment');
        setError('El pago fue rechazado. Por favor, intenta nuevamente.');
      } else if (paymentStatus === 'pending') {
        setPaymentStatus('pending');
        setCurrentStep('payment');
        setError('El pago está pendiente de confirmación.');
      }
      
      // Limpiar localStorage
      localStorage.removeItem('currentPurchaseId');
    }
  }, [loadNumbers]);

  // Timer de reserva
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentStep === 'payment' && reservationTimer > 0) {
      interval = setInterval(() => {
        setReservationTimer(prev => {
          if (prev <= 1) {
            // Timeout - liberar números
            handlePaymentTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, reservationTimer]);

  const handlePaymentTimeout = async () => {
    // Si hay una compra actual, cancelarla en el backend
    if (currentPurchase && currentPurchase.id) {
      try {
        console.log('Cancelling purchase due to timeout:', currentPurchase.id);
        await apiService.cancelPayment(currentPurchase.id, 'Payment timeout - reservation expired');
      } catch (error) {
        console.error('Error cancelling purchase on timeout:', error);
      }
    }
    
    // Limpiar estado local
    setCurrentStep('selection');
    setSelectedNumbers(new Set());
    setPaymentStatus('pending');
    setReservationTimer(0);
    setCurrentPurchase(null);
    
    // Recargar números para reflejar cambios
    await loadNumbers();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getNumberColor = (status: string, purchaseId?: string) => {
    // Si es un número bloqueado para venta manual, color violeta
    if (status === 'sold' && purchaseId?.startsWith('ADMIN-BLOCK')) {
      return 'bg-purple-500 text-white cursor-not-allowed opacity-60';
    }

    switch (status) {
      case 'sold': return 'bg-red-500 text-white cursor-not-allowed opacity-50';
      case 'reserved': return 'bg-orange-400 text-white cursor-not-allowed opacity-70';
      case 'selected': return 'bg-blue-500 text-white cursor-pointer hover:bg-blue-600 ring-2 ring-blue-300';
      default: return 'bg-green-500 text-white cursor-pointer hover:bg-green-600 hover:scale-105 transition-all duration-150';
    }
  };

  const validateForm = () => {
    const { buyerName, studentName, division, course, email } = formData;
    return buyerName.trim() && studentName.trim() && division.trim() && course.trim() && email.trim();
  };

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // NUEVO: Verificar disponibilidad una última vez antes de proceder
      await loadNumbers(); // Actualizar estado actual
      
      const numbersArray = Array.from(selectedNumbers).sort((a, b) => a - b);
      const unavailable = numbersArray.filter(num => {
        const status = getNumberStatus(num);
        return status !== 'available' && status !== 'selected';
      });
      
      if (unavailable.length > 0) {
        setError(`Los números ${unavailable.join(', ')} ya no están disponibles. Por favor, selecciona otros números.`);
        setLoading(false);
        setCurrentStep('selection');
        // Deseleccionar números no disponibles
        setSelectedNumbers(prev => {
          const newSet = new Set(prev);
          unavailable.forEach(num => newSet.delete(num));
          return newSet;
        });
        return;
      }
      
      // Crear compra y reservar números en la base de datos
      const purchaseData = {
        ...formData,
        numbers: Array.from(selectedNumbers).sort((a, b) => a - b),
        totalAmount: selectedNumbers.size * PRICE_PER_NUMBER
      };
      
      const result = await apiService.createPurchase(purchaseData);
      
      if (!result.success) {
        // Manejar error de conflicto (números no disponibles)
        if (result.unavailableNumbers) {
          setError(`Los números ${result.unavailableNumbers.join(', ')} ya fueron reservados. Por favor, actualiza y selecciona otros.`);
          setCurrentStep('selection');
          // Recargar números para ver estado actualizado
          await loadNumbers();
          // Limpiar selección de números no disponibles
          setSelectedNumbers(prev => {
            const newSet = new Set(prev);
            result.unavailableNumbers?.forEach((num: number) => newSet.delete(num));
            return newSet;
          });
          setLoading(false);
          return;
        }
        throw new Error(result.error || 'Error al procesar la compra');
      }
      
      // Crear objeto de compra para mostrar
      const purchase: Purchase = {
        id: result.purchaseId!,  // Sabemos que existe si success es true
        ...formData,
        numbers: purchaseData.numbers,
        totalAmount: purchaseData.totalAmount,
        status: 'approved', // Marcamos como aprobado porque estamos simulando el pago
        createdAt: new Date()
      };
      
      // Crear preferencia de MercadoPago REAL
      const mpPreference = await apiService.createMercadoPagoPreference(purchase);
      purchase.mercadoPagoPreferenceId = mpPreference.preferenceId;
      
      setCurrentPurchase(purchase);
      setCurrentStep('payment');
      setReservationTimer(RESERVATION_TIMEOUT);
      
      // Guardar ID de compra para cuando vuelva de MercadoPago
      localStorage.setItem('currentPurchaseId', purchase.id);
      
      // Redirigir a MercadoPago
      console.log('Redirecting to MercadoPago checkout...');
      window.location.href = mpPreference.initPoint;
      
    } catch (err: any) {
      console.error('Error procesando la compra:', err);
      
      // Manejar errores específicos de disponibilidad
      if (err.message?.includes('no están disponibles')) {
        setError(err.message);
        setCurrentStep('selection');
        await loadNumbers(); // Recargar para ver estado actual
      } else {
        setError(err.message || 'Error al procesar la compra. Por favor, intenta nuevamente.');
      }
      
      setLoading(false);
    }
  };

  const simulatePayment = async (status: 'approved' | 'rejected') => {
    if (!currentPurchase) {
      console.error('No current purchase to process');
      return;
    }
    
    setPaymentStatus('processing');
    
    try {
      // Simular delay de procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (status === 'approved') {
        // Confirmar pago en el backend
        console.log('Confirming payment for purchase:', currentPurchase.id);
        await apiService.confirmPayment(currentPurchase.id);
        
        // Actualizar estado local
        currentPurchase.status = 'approved';
        currentPurchase.mercadoPagoPaymentId = `PAY-${Date.now()}`;
        setPaymentStatus('approved');
        
        // Limpiar números seleccionados
        setSelectedNumbers(new Set());
        
        // Recargar números desde la BD para reflejar los cambios
        console.log('Reloading numbers after payment confirmation...');
        await loadNumbers();
        
        // Ir a confirmación
        setCurrentStep('confirmation');
        setReservationTimer(0);
      } else {
        // Cancelar pago en el backend
        console.log('Cancelling payment for purchase:', currentPurchase.id);
        await apiService.cancelPayment(currentPurchase.id, 'Payment rejected by simulation');
        
        // Actualizar estado local
        currentPurchase.status = 'rejected';
        setPaymentStatus('rejected');
        
        // Limpiar y volver a selección
        handlePaymentTimeout();
      }
    } catch (error) {
      console.error('Error processing simulated payment:', error);
      setPaymentStatus('rejected');
      alert('Error al procesar el pago. Por favor intenta nuevamente.');
      handlePaymentTimeout();
    }
  };

  const resetApp = async () => {
    setSelectedNumbers(new Set());
    setCurrentStep('selection');
    setCurrentView('app');
    setFormData({
      buyerName: '',
      studentName: '',
      division: '',
      course: '',
      email: '',
      phone: ''
    });
    setCurrentPurchase(null);
    setPaymentStatus('pending');
    setReservationTimer(0);
    // IMPORTANTE: Recargar números para sincronizar con BD
    console.log('Reloading numbers after reset...');
    await loadNumbers();
  };

  // =========== NÚMERO GRID OPTIMIZADO (20x20) CON PAGINACIÓN ===========
  const NumberGrid = () => {
    const [currentPage, setCurrentPage] = useState(1);

    // Mostrar mensaje de cierre si las ventas están cerradas
    if (VENTAS_CERRADAS) {
      return (
        <div className="flex flex-col justify-center items-center py-20 px-8">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-12 shadow-xl text-center max-w-2xl">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <Check className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">
              ¡Gracias por participar!
            </h2>
            <p className="text-xl text-gray-600 mb-6">
              La venta de rifas ha finalizado
            </p>
            <div className="border-t border-gray-200 pt-6">
              <p className="text-gray-500">
                El sorteo se realizará próximamente
              </p>
              <p className="text-sm text-gray-400 mt-2">
                ¡Mucha suerte a todos los participantes!
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
          <span className="ml-2 text-gray-600">Cargando números...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadNumbers}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      );
    }

    // Grid 20x20 = 400 números por página
    const rows = 20;
    const cols = 20;
    const numbersPerPage = rows * cols;
    const totalPages = Math.ceil(TOTAL_NUMBERS / numbersPerPage); // 5 páginas
    const startNumber = (currentPage - 1) * numbersPerPage + 1;
    const endNumber = Math.min(currentPage * numbersPerPage, TOTAL_NUMBERS);

    return (
      <div className="p-4">
        {/* Indicador de página y navegación superior */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-lg font-bold text-gray-700">
            Números {startNumber} - {endNumber} de {TOTAL_NUMBERS}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              ← Anterior
            </button>
            
            <span className="px-4 py-2 font-medium text-gray-700">
              Página {currentPage} de {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* Grid de números */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(40px, 1fr))` }}>
            {Array.from({ length: numbersPerPage }, (_, index) => {
              const number = startNumber + index;
              if (number > TOTAL_NUMBERS) return null; // Por si acaso

              const status = getNumberStatus(number);
              const raffleNumber = numbers.find(n => n.number === number);

              return (
                <button
                  key={number}
                  onClick={() => toggleNumber(number)}
                  className={`
                    w-10 h-10 text-xs font-bold rounded flex items-center justify-center
                    ${getNumberColor(status, raffleNumber?.purchaseId)}
                    ${status === 'sold' || status === 'reserved' ? '' : 'hover:shadow-lg'}
                  `}
                  disabled={status === 'sold' || status === 'reserved'}
                  title={`Número ${number} - ${status === 'sold' ? 'Vendido' : status === 'reserved' ? 'Reservado' : status === 'selected' ? 'Seleccionado' : 'Disponible'}`}
                >
                  {number}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navegación inferior con acceso rápido a páginas */}
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Primera
          </button>
          
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 text-sm rounded ${
                currentPage === i + 1
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {i + 1}
            </button>
          ))}
          
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Última
          </button>
        </div>
      </div>
    );
  };

  const SelectionSummary = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500 sticky top-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <ShoppingCart className="mr-2" />
        Resumen de Selección
      </h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Números seleccionados:</span>
          <span className="font-bold text-gray-800">{selectedNumbers.size}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Precio por número:</span>
          <span className="font-bold text-gray-800">${PRICE_PER_NUMBER.toLocaleString('es-AR')}</span>
        </div>
        
        <div className="border-t pt-3 flex justify-between text-lg">
          <span className="font-bold text-gray-800">Total:</span>
          <span className="font-bold text-green-600">
            ${(selectedNumbers.size * PRICE_PER_NUMBER).toLocaleString('es-AR')}
          </span>
        </div>
        
        {selectedNumbers.size > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Números seleccionados:</p>
            <div className="max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedNumbers).sort((a, b) => a - b).map(num => (
                  <span
                    key={num}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs cursor-pointer hover:bg-blue-200"
                    onClick={() => toggleNumber(num)}
                    title="Click para deseleccionar"
                  >
                    {num} ×
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <button
            onClick={() => setCurrentStep('form')}
            disabled={selectedNumbers.size === 0}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Continuar con la Compra
          </button>
          
          {selectedNumbers.size > 0 && (
            <button
              onClick={() => setSelectedNumbers(new Set())}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Limpiar Selección
            </button>
          )}
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="mt-6 pt-4 border-t text-sm text-gray-600">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="font-bold text-green-600">{numbers.filter(n => n.status === 'available').length}</div>
            <div>Disponibles</div>
          </div>
          <div>
            <div className="font-bold text-red-600">{numbers.filter(n => n.status === 'sold').length}</div>
            <div>Vendidos</div>
          </div>
        </div>
      </div>
    </div>
  );

  // PersonalDataForm is now defined outside RifasApp

  const PaymentStatus = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 text-center max-w-md mx-auto">
      <div className="mb-6">
        {paymentStatus === 'pending' && (
          <>
            <Clock className="mx-auto mb-4 text-orange-500" size={48} />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Esperando Pago</h2>
            <p className="text-gray-600 mb-4">Preparando redirección a MercadoPago...</p>
            {reservationTimer > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-700">
                  <Clock className="inline mr-1" size={14} />
                  Reserva expira en: <strong>{formatTime(reservationTimer)}</strong>
                </p>
              </div>
            )}
          </>
        )}
        
        {paymentStatus === 'processing' && (
          <>
            <RefreshCw className="mx-auto mb-4 text-blue-500 animate-spin" size={48} />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Procesando Pago</h2>
            <p className="text-gray-600">Verificando el estado del pago...</p>
          </>
        )}
      </div>

      {currentPurchase && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 text-left">
          <h4 className="font-medium text-gray-800 mb-2">Detalles de la Compra:</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p><strong>ID:</strong> {currentPurchase.id}</p>
            <p><strong>Comprador:</strong> {currentPurchase.buyerName}</p>
            <p><strong>Estudiante:</strong> {currentPurchase.studentName} - {currentPurchase.course} "{currentPurchase.division}"</p>
            <p><strong>Números:</strong> {currentPurchase.numbers.join(', ')}</p>
            <p><strong>Total:</strong> ${currentPurchase.totalAmount.toLocaleString('es-AR')}</p>
            {currentPurchase.mercadoPagoPreferenceId && (
              <p><strong>Preferencia MP:</strong> {currentPurchase.mercadoPagoPreferenceId}</p>
            )}
          </div>
        </div>
      )}

      {/* Integración con MercadoPago Real */}
      {paymentStatus === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-2">
            <AlertCircle className="inline mr-1" size={14} />
            Serás redirigido automáticamente a MercadoPago
          </p>
          <p className="text-xs text-blue-600">
            Si la redirección no ocurre, recarga la página.
          </p>
        </div>
      )}
    </div>
  );

  const ConfirmationPage = () => (
    <div className="bg-white rounded-lg shadow-lg p-6 text-center max-w-md mx-auto">
      <Check className="mx-auto mb-4 text-green-500" size={64} />
      <h2 className="text-2xl font-bold text-green-600 mb-4">¡Compra Exitosa!</h2>
      
      {currentPurchase && (
        <div className="bg-green-50 p-4 rounded-lg mb-6 text-left">
          <h3 className="font-bold text-gray-800 mb-3">Detalles de tu compra:</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p className="text-gray-700"><strong className="text-gray-800">ID:</strong> {currentPurchase.id}</p>
            <p className="text-gray-700"><strong className="text-gray-800">Comprador:</strong> {currentPurchase.buyerName}</p>
            <p className="text-gray-700"><strong className="text-gray-800">Estudiante:</strong> {currentPurchase.studentName}</p>
            <p className="text-gray-700"><strong className="text-gray-800">Curso:</strong> {currentPurchase.course} "{currentPurchase.division}"</p>
            <p className="text-gray-700"><strong className="text-gray-800">Números comprados:</strong> {currentPurchase.numbers.join(', ')}</p>
            <p className="text-gray-700"><strong className="text-gray-800">Total pagado:</strong> ${currentPurchase.totalAmount.toLocaleString('es-AR')}</p>
            <p className="text-gray-700"><strong className="text-gray-800">Método de pago:</strong> MercadoPago</p>
            <p className="text-gray-700"><strong className="text-gray-800">Fecha:</strong> {currentPurchase.createdAt.toLocaleDateString('es-AR')}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <AlertCircle className="mx-auto mb-2 text-blue-500" size={24} />
        <p className="text-sm text-blue-700">
          Recibirás un email de confirmación en {formData.email} con todos los detalles de tu compra.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={resetApp}
          className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-600 transition-colors"
        >
          Realizar Nueva Compra
        </button>
        
        <button
          onClick={() => setCurrentView('admin')}
          className="w-full bg-gray-500 text-white py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Ver Panel de Administración
        </button>
      </div>
    </div>
  );

  const AdminPanel = () => {
    const totalSold = numbers.filter(n => n.status === 'sold').length;
    const totalReserved = numbers.filter(n => n.status === 'reserved').length;
    const totalAvailable = numbers.filter(n => n.status === 'available').length;
    const totalRevenue = totalSold * PRICE_PER_NUMBER;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <BarChart3 className="mr-2" />
              Panel de Administración
            </h1>
            <button
              onClick={() => setCurrentView('app')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Volver a la App
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Números Vendidos</p>
                <p className="text-2xl font-bold text-green-600">{totalSold}</p>
              </div>
              <Check className="text-green-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Números Reservados</p>
                <p className="text-2xl font-bold text-orange-600">{totalReserved}</p>
              </div>
              <Clock className="text-orange-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disponibles</p>
                <p className="text-2xl font-bold text-blue-600">{totalAvailable}</p>
              </div>
              <Database className="text-blue-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ingresos</p>
                <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString('es-AR')}</p>
              </div>
              <CreditCard className="text-green-500" size={32} />
            </div>
          </div>
        </div>

        {/* Progreso */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Progreso de Ventas</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
            <div 
              className="bg-green-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${(totalSold / TOTAL_NUMBERS) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{totalSold} / {TOTAL_NUMBERS} vendidos</span>
            <span>{((totalSold / TOTAL_NUMBERS) * 100).toFixed(1)}% completado</span>
          </div>
        </div>

        {/* Lista de compras recientes */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Compras Recientes</h3>
            <button className="text-blue-500 hover:text-blue-700 flex items-center">
              <Download className="mr-1" size={16} />
              Exportar
            </button>
          </div>
          
          {purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Comprador</th>
                    <th className="px-4 py-2 text-left">Estudiante</th>
                    <th className="px-4 py-2 text-left">Números</th>
                    <th className="px-4 py-2 text-left">Total</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.slice(0, 10).map(purchase => (
                    <tr key={purchase.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs">{purchase.id}</td>
                      <td className="px-4 py-2">{purchase.buyerName}</td>
                      <td className="px-4 py-2">{purchase.studentName}</td>
                      <td className="px-4 py-2">{purchase.numbers.length} números</td>
                      <td className="px-4 py-2">${purchase.totalAmount.toLocaleString('es-AR')}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          purchase.status === 'approved' ? 'bg-green-100 text-green-800' :
                          purchase.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No hay compras registradas aún</p>
          )}
        </div>
      </div>
    );
  };

  const Legend = () => (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <h4 className="font-bold text-gray-800 mb-3">Leyenda:</h4>
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
          <span className="text-gray-700">Disponible</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 rounded mr-2 ring-2 ring-blue-300"></div>
          <span className="text-gray-700">Seleccionado</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-orange-400 rounded mr-2 opacity-70"></div>
          <span className="text-gray-700">Reservado (temporal)</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 rounded mr-2 opacity-50"></div>
          <span className="text-gray-700">Vendido</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t text-xs text-gray-600">
        <p><strong>Tip:</strong> Haz click en los números verdes para seleccionarlos. Los números seleccionados aparecen en azul.</p>
        <p>Puedes hacer click en los números azules del resumen para deseleccionarlos.</p>
      </div>
    </div>
  );

  // =========== RENDER PRINCIPAL ===========

  if (currentView === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-6">
          <AdminPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div 
              className="cursor-pointer"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              <h1 className="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
                🎫 Rifa Escolar 2025
              </h1>
              <p className="text-gray-600 mt-1">
                Selecciona tus números de la suerte • {numbers.filter(n => n.status === 'sold').length}/{TOTAL_NUMBERS} vendidos
              </p>
            </div>
            {!VENTAS_CERRADAS && (
              <div className="flex gap-2">
                <button
                  onClick={loadNumbers}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center disabled:opacity-50"
                >
                  <RefreshCw className={`mr-1 ${loading ? 'animate-spin' : ''}`} size={16} />
                  Actualizar
                </button>
                {/* Botón Admin ocultado para usuarios finales
                <button
                  onClick={() => setCurrentView('admin')}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 flex items-center"
                >
                  <Settings className="mr-1" size={16} />
                  Admin
                </button>
                */}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Mostrar error global si existe */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <AlertCircle className="text-red-500 mr-2 flex-shrink-0" size={20} />
              <div>
                <p className="text-red-800 font-medium">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 text-sm underline mt-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navegación por pasos */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-4">
            {[
              { step: 'selection', label: 'Selección', icon: ShoppingCart },
              { step: 'form', label: 'Datos', icon: User },
              { step: 'payment', label: 'Pago', icon: CreditCard },
              { step: 'confirmation', label: 'Confirmación', icon: Check }
            ].map(({ step, label, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                  ${currentStep === step 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : index < ['selection', 'form', 'payment', 'confirmation'].indexOf(currentStep)
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }
                `}>
                  <Icon size={16} />
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep === step ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {label}
                </span>
                {index < 3 && <div className="ml-4 w-8 h-0.5 bg-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido principal */}
        {currentStep === 'selection' && (
          <>
            <Legend />
            <div className="grid lg:grid-cols-4 gap-6">
              <div className={VENTAS_CERRADAS ? "lg:col-span-4" : "lg:col-span-3"}>
                <div className="bg-white rounded-lg shadow-lg">
                  {!VENTAS_CERRADAS && (
                    <div className="p-4 border-b">
                      <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">
                          Seleccionar Números de Rifa
                        </h2>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-green-600">
                            ✓ {numbers.filter(n => n.status === 'available').length} disponibles
                          </span>
                          <span className="text-red-600">
                            ✗ {numbers.filter(n => n.status === 'sold').length} vendidos
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <NumberGrid />
                </div>
              </div>
              {!VENTAS_CERRADAS && (
                <div className="lg:col-span-1">
                  <SelectionSummary />
                </div>
              )}
            </div>
          </>
        )}

        {currentStep === 'form' && (
          <PersonalDataForm 
            formData={formData}
            setFormData={setFormData}
            setCurrentStep={setCurrentStep}
            handleFormSubmit={handleFormSubmit}
            selectedNumbers={selectedNumbers}
            setSelectedNumbers={setSelectedNumbers}
            PRICE_PER_NUMBER={PRICE_PER_NUMBER}
            loading={loading}
          />
        )}
        {currentStep === 'payment' && <PaymentStatus />}
        {currentStep === 'confirmation' && <ConfirmationPage />}
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 mt-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-sm mb-2">
              © 2024 Colegio. Sistema desarrollado para evento escolar.
            </p>
            <p className="text-xs text-gray-400">
              Integrado con MercadoPago • Base de datos Turso • Hosting Vercel
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RifasApp;