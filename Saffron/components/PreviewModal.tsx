import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  ScrollView,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { executeCrossChain, CrossChainProgress } from '@/api/cross-chain';

const { width, height } = Dimensions.get('window');

export type TradingStrategy = 
  | 'market'           // Immediate execution at market price
  | 'limit'            // Limit order at specific price
  | 'twap'             // Time-Weighted Average Price (split over time)
  | 'vwap'             // Volume-Weighted Average Price
  | 'iceberg'          // Large order split into smaller chunks
  | 'smart_routing'    // AI-optimized execution
  | 'delayed'          // Delayed execution to avoid front-running

export interface StrategyOption {
  id: TradingStrategy;
  name: string;
  description: string;
  icon: string;
  estimatedTime: string;
  priceImpact: 'low' | 'medium' | 'high';
  recommended?: boolean;
}

interface TradePreview {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  type: 'market' | 'limit';
  estimatedFees: string;
  valid: boolean;
  error?: string;
  strategy?: TradingStrategy;
}

interface BridgePreview {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  estimatedTime: number;
  fees: {
    sourceFee: string;
    destinationFee: string;
    bridgeFee?: string;
  };
  valid: boolean;
  error?: string;
}

interface PreviewModalProps {
  visible: boolean;
  preview: TradePreview | BridgePreview | null;
  onConfirm: (strategy?: TradingStrategy) => void;
  onCancel: () => void;
}

const TRADING_STRATEGIES: StrategyOption[] = [
  {
    id: 'market',
    name: 'Market Order',
    description: 'Execute immediately at current market price',
    icon: 'bolt.fill',
    estimatedTime: 'Instant',
    priceImpact: 'medium',
  },
  {
    id: 'limit',
    name: 'Limit Order',
    description: 'Execute only at your specified price or better',
    icon: 'scope',
    estimatedTime: 'Until filled',
    priceImpact: 'low',
  },
  {
    id: 'twap',
    name: 'TWAP Strategy',
    description: 'Split order over time to reduce market impact',
    icon: 'clock.fill',
    estimatedTime: '5-30 min',
    priceImpact: 'low',
    recommended: true,
  },
  {
    id: 'vwap',
    name: 'VWAP Strategy',
    description: 'Execute based on volume patterns for fair price',
    icon: 'chart.bar.fill',
    estimatedTime: '10-60 min',
    priceImpact: 'low',
  },
  {
    id: 'iceberg',
    name: 'Iceberg Order',
    description: 'Hide large orders by splitting into smaller chunks',
    icon: 'eye.slash.fill',
    estimatedTime: '15-90 min',
    priceImpact: 'low',
  },
  {
    id: 'smart_routing',
    name: 'Smart Routing',
    description: 'AI-optimized execution across multiple venues',
    icon: 'cpu.fill',
    estimatedTime: '1-10 min',
    priceImpact: 'low',
  },
  {
    id: 'delayed',
    name: 'Anti-MEV',
    description: 'Delayed execution to prevent front-running',
    icon: 'shield.fill',
    estimatedTime: '30-120 sec',
    priceImpact: 'low',
  },
];

// Custom Slider Component
const CustomSlider = ({ value, onValueChange, minimum = 0, maximum = 100, step = 1 }: {
  value: number;
  onValueChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
  step?: number;
}) => {
  const colorScheme = useColorScheme();
  const [sliderValue] = useState(new Animated.Value(value));
  const [sliderWidth, setSliderWidth] = useState(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      const newValue = Math.max(minimum, Math.min(maximum, 
        minimum + (gestureState.moveX / sliderWidth) * (maximum - minimum)
      ));
      const steppedValue = Math.round(newValue / step) * step;
      sliderValue.setValue(steppedValue);
      onValueChange(steppedValue);
    },
  });

  const thumbPosition = sliderValue.interpolate({
    inputRange: [minimum, maximum],
    outputRange: [0, sliderWidth - 24],
    extrapolate: 'clamp',
  });

  return (
    <View 
      style={styles.sliderContainer}
      onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.sliderTrack, { backgroundColor: `${Colors[colorScheme ?? 'light'].tint}30` }]}>
        <View 
          style={[
            styles.sliderProgress, 
            { 
              backgroundColor: Colors[colorScheme ?? 'light'].tint,
              width: `${((value - minimum) / (maximum - minimum)) * 100}%`
            }
          ]} 
        />
      </View>
      <Animated.View
        style={[
          styles.sliderThumb,
          {
            backgroundColor: Colors[colorScheme ?? 'light'].tint,
            transform: [{ translateX: thumbPosition }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.sliderThumbInner} />
      </Animated.View>
    </View>
  );
};

export default function PreviewModal({ visible, preview, onConfirm, onCancel }: PreviewModalProps) {
  const colorScheme = useColorScheme();
  const [selectedStrategy, setSelectedStrategy] = useState<TradingStrategy>('market');
  const [showStrategies, setShowStrategies] = useState(false);
  const [slippage, setSlippage] = useState(0.5); // Slippage tolerance percentage

  // Cross-chain related state
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeProgress, setBridgeProgress] = useState<CrossChainProgress | null>(null);

  if (!preview) return null;

  const isTradePreview = 'symbol' in preview;

  const handleConfirm = () => {
    console.log('========== handleConfirm called ==========');
    console.log('isTradePreview:', isTradePreview);
    console.log('preview:', preview);

    if (isTradePreview) {
      console.log('Executing trade flow');
      onConfirm(selectedStrategy);
    } else {
      console.log('Executing cross-chain flow');
      // Cross-chain operation
      handleBridgeConfirm();
    }
  };

  // Handle cross-chain confirmation
  const handleBridgeConfirm = async () => {
    console.log('========== handleBridgeConfirm started ==========');
    console.log('Setting isBridging = true');
    setIsBridging(true);

    try {
      console.log('Preparing to call executeCrossChain...');

      // Execute cross-chain, pass progress callback
      const result = await executeCrossChain((progress) => {
        console.log('🔄 Progress update:', progress);
        setBridgeProgress(progress);
      });

      console.log('✅ executeCrossChain completed:', result);

      if (result.success) {
        console.log('Cross-chain successful! Showing success message');
        Alert.alert('Cross-chain successful!', `Successfully bridged ${result.usdcAmount} USDC\n\nBase TxHash: ${result.baseTxHash?.substring(0, 10)}...\nAptos TxHash: ${result.aptosTxHash?.substring(0, 10)}...`);
        onConfirm(); // Notify parent component
      } else {
        console.log('❌ Cross-chain failed:', result.error);
        Alert.alert('Cross-chain failed', result.error || 'Unknown error');
      }

    } catch (error: any) {
      console.log('❌ Caught error:', error);
      console.error('Error details:', error.message, error.stack);
      Alert.alert('Error', error.message);
    } finally {
      console.log('Cleaning up state: setting isBridging = false');
      setIsBridging(false);
      setBridgeProgress(null);
    }
  };

  const getPriceImpactColor = (impact: 'low' | 'medium' | 'high') => {
    switch (impact) {
      case 'low': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'high': return '#F44336';
    }
  };

  // Render cross-chain progress bar
  const renderBridgeProgress = () => {
    if (!bridgeProgress) return null;

    return (
      <ThemedView style={styles.progressContainer}>
        <ThemedText style={styles.progressTitle}>
          Cross-chain Progress ({bridgeProgress.step}/{bridgeProgress.totalSteps})
        </ThemedText>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${bridgeProgress.percentage || 0}%`,
                backgroundColor: bridgeProgress.status === 'failed' ? '#F44336' : '#4CAF50'
              }
            ]}
          />
        </View>

        {/* Status text */}
        <ThemedText style={styles.progressMessage}>
          {bridgeProgress.message}
        </ThemedText>

        {/* Transaction hash (if available) */}
        {bridgeProgress.txHash && (
          <ThemedText style={styles.txHash}>
            TxHash: {bridgeProgress.txHash.substring(0, 10)}...{bridgeProgress.txHash.substring(bridgeProgress.txHash.length - 8)}
          </ThemedText>
        )}

        {/* Step indicator */}
        <ThemedView style={styles.stepsIndicator}>
          <StepIndicator
            step={1}
            current={bridgeProgress.step}
            label="Base Burn"
            colorScheme={colorScheme}
          />
          <StepIndicator
            step={2}
            current={bridgeProgress.step}
            label="Circle Sign"
            colorScheme={colorScheme}
          />
          <StepIndicator
            step={3}
            current={bridgeProgress.step}
            label="Aptos Receive"
            colorScheme={colorScheme}
          />
        </ThemedView>
      </ThemedView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <ThemedView style={[
          styles.modalContainer,
          { backgroundColor: Colors[colorScheme ?? 'light'].background }
        ]}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <IconSymbol 
              name={isTradePreview ? "chart.line.uptrend.xyaxis" : "arrow.left.arrow.right"} 
              size={24} 
              color={Colors[colorScheme ?? 'light'].tint} 
            />
            <ThemedText style={styles.title}>
              {isTradePreview ? 'Trade Preview' : 'Bridge Preview'}
            </ThemedText>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <IconSymbol name="xmark" size={20} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </ThemedView>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {isTradePreview ? (
              // Trade Preview Content
              <ThemedView>
                <ThemedText style={styles.mainLabel}>
                  {preview.side.toUpperCase()} {preview.size} {preview.symbol}
                </ThemedText>
                
                <ThemedView style={styles.detailsContainer}>
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Order Type:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {preview.type.toUpperCase()}
                    </ThemedText>
                  </ThemedView>
                  
                  {preview.price && (
                    <ThemedView style={styles.detailRow}>
                      <ThemedText style={styles.detailLabel}>Price:</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        ${preview.price.toFixed(4)}
                      </ThemedText>
                    </ThemedView>
                  )}
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Est. Fees:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      ${preview.estimatedFees}
                    </ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Market:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      Ekiden (Aptos)
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                {/* Strategy Selection */}
                <ThemedView style={styles.strategySection}>
                  <ThemedView style={styles.strategySectionHeader}>
                    <ThemedText style={styles.strategySectionTitle}>Execution Strategy</ThemedText>
                    <TouchableOpacity 
                      onPress={() => setShowStrategies(!showStrategies)}
                      style={styles.strategyToggle}
                    >
                      <ThemedText style={[styles.strategyToggleText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                        {showStrategies ? 'Hide Options' : 'Show Options'}
                      </ThemedText>
                      <IconSymbol 
                        name={showStrategies ? "chevron.up" : "chevron.down"} 
                        size={16} 
                        color={Colors[colorScheme ?? 'light'].tint} 
                      />
                    </TouchableOpacity>
                  </ThemedView>

                  {/* Current Strategy Display */}
                  <ThemedView style={[styles.currentStrategy, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
                    <ThemedView style={styles.currentStrategyInfo}>
                      <IconSymbol 
                        name={(TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.icon || 'bolt.fill') as any} 
                        size={20} 
                        color={Colors[colorScheme ?? 'light'].tint} 
                      />
                      <ThemedView style={styles.currentStrategyText}>
                        <ThemedText style={styles.currentStrategyName}>
                          {TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.name}
                        </ThemedText>
                        <ThemedText style={styles.currentStrategyDesc}>
                          {TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.description}
                        </ThemedText>
                      </ThemedView>
                    </ThemedView>
                    <ThemedView style={styles.currentStrategyMeta}>
                      <ThemedText style={styles.currentStrategyTime}>
                        {TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.estimatedTime}
                      </ThemedText>
                      <ThemedView style={[
                        styles.priceImpactBadge, 
                        { backgroundColor: getPriceImpactColor(TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.priceImpact || 'medium') }
                      ]}>
                        <ThemedText style={styles.priceImpactText}>
                          {TRADING_STRATEGIES.find(s => s.id === selectedStrategy)?.priceImpact.toUpperCase()} IMPACT
                        </ThemedText>
                      </ThemedView>
                    </ThemedView>
                  </ThemedView>

                  {/* Strategy Options */}
                  {showStrategies && (
                    <ThemedView style={styles.strategyOptions}>
                      {TRADING_STRATEGIES.map((strategy) => (
                        <TouchableOpacity
                          key={strategy.id}
                          style={[
                            styles.strategyOption,
                            {
                              borderColor: selectedStrategy === strategy.id 
                                ? Colors[colorScheme ?? 'light'].tint 
                                : Colors[colorScheme ?? 'light'].tabIconDefault,
                              backgroundColor: selectedStrategy === strategy.id 
                                ? `${Colors[colorScheme ?? 'light'].tint}15` 
                                : 'transparent'
                            }
                          ]}
                          onPress={() => setSelectedStrategy(strategy.id)}
                        >
                          <ThemedView style={styles.strategyOptionHeader}>
                            <ThemedView style={styles.strategyOptionLeft}>
                              <IconSymbol 
                                name={strategy.icon as any} 
                                size={18} 
                                color={selectedStrategy === strategy.id 
                                  ? Colors[colorScheme ?? 'light'].tint 
                                  : Colors[colorScheme ?? 'light'].text} 
                              />
                              <ThemedText style={[
                                styles.strategyOptionName,
                                { color: selectedStrategy === strategy.id 
                                  ? Colors[colorScheme ?? 'light'].tint 
                                  : Colors[colorScheme ?? 'light'].text }
                              ]}>
                                {strategy.name}
                                {strategy.recommended && (
                                  <ThemedText style={styles.recommendedBadge}> ⭐</ThemedText>
                                )}
                              </ThemedText>
                            </ThemedView>
                            <ThemedView style={styles.strategyOptionRight}>
                              <ThemedText style={styles.strategyOptionTime}>
                                {strategy.estimatedTime}
                              </ThemedText>
                              <ThemedView style={[
                                styles.priceImpactBadgeSmall, 
                                { backgroundColor: getPriceImpactColor(strategy.priceImpact) }
                              ]}>
                                <ThemedText style={styles.priceImpactTextSmall}>
                                  {strategy.priceImpact.charAt(0).toUpperCase()}
                                </ThemedText>
                              </ThemedView>
                            </ThemedView>
                          </ThemedView>
                          <ThemedText style={styles.strategyOptionDesc}>
                            {strategy.description}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ThemedView>
                  )}
                </ThemedView>

              </ThemedView>
            ) : (
              // Bridge Preview Content
              <ThemedView>
                <ThemedText style={styles.mainLabel}>
                  Bridge ${preview.amount} USDC
                </ThemedText>
                
                <ThemedView style={styles.detailsContainer}>
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>From:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {preview.sourceChain.charAt(0).toUpperCase() + preview.sourceChain.slice(1)}
                    </ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>To:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {preview.destinationChain.charAt(0).toUpperCase() + preview.destinationChain.slice(1)}
                    </ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Est. Time:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      {Math.round(preview.estimatedTime / 60)} minutes
                    </ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Bridge Fee:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      ${preview.fees.bridgeFee || '0.001'}
                    </ThemedText>
                  </ThemedView>
                  
                  <ThemedView style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>Protocol:</ThemedText>
                    <ThemedText style={styles.detailValue}>
                      CCTP (Circle)
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                {/* Cross-chain progress display */}
                {isBridging && renderBridgeProgress()}
              </ThemedView>
            )}

            {/* Error Message */}
            {!preview.valid && preview.error && (
              <ThemedView style={[styles.errorContainer, { borderColor: '#F44336' }]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#F44336" />
                <ThemedText style={styles.errorText}>
                  {preview.error}
                </ThemedText>
              </ThemedView>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <ThemedView style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: Colors[colorScheme ?? 'light'].tabIconDefault }]}
              onPress={onCancel}
              disabled={isBridging}
            >
              <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Cancel
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: (preview.valid && !isBridging) ? Colors[colorScheme ?? 'light'].tint : '#CCCCCC',
                  opacity: (preview.valid && !isBridging) ? 1 : 0.6
                }
              ]}
              onPress={() => {
                console.log('🔘 Start Bridge button clicked!');
                console.log('preview.valid:', preview.valid);
                console.log('isBridging:', isBridging);
                console.log('disabled:', !preview.valid || isBridging);
                handleConfirm();
              }}
              disabled={!preview.valid || isBridging}
            >
              <ThemedText style={[styles.buttonText, { color: 'white' }]}>
                {isBridging ? 'Bridging...' : (isTradePreview ? 'Execute Trade' : 'Start Bridge')}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </View>
    </Modal>
  );
}

// Step indicator component
const StepIndicator = ({ step, current, label, colorScheme }: {
  step: number;
  current: number;
  label: string;
  colorScheme: 'light' | 'dark' | null;
}) => {
  const isCompleted = current > step;
  const isCurrent = current === step;

  return (
    <ThemedView style={styles.stepItem}>
      <View style={[
        styles.stepCircle,
        isCompleted && styles.stepCompleted,
        isCurrent && styles.stepCurrent,
      ]}>
        {isCompleted ? (
          <IconSymbol name="checkmark" size={14} color="white" />
        ) : (
          <ThemedText style={styles.stepNumber}>{step}</ThemedText>
        )}
      </View>
      <ThemedText style={styles.stepLabel}>{label}</ThemedText>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    padding: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  mainLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Strategy Selection Styles
  strategySection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  strategySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  strategySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  strategyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strategyToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  currentStrategy: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  currentStrategyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  currentStrategyText: {
    flex: 1,
    marginLeft: 12,
  },
  currentStrategyName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  currentStrategyDesc: {
    fontSize: 14,
    opacity: 0.8,
  },
  currentStrategyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentStrategyTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  priceImpactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceImpactText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  strategyOptions: {
    gap: 8,
  },
  strategyOption: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  strategyOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  strategyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  strategyOptionName: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  recommendedBadge: {
    fontSize: 12,
  },
  strategyOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strategyOptionTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  priceImpactBadgeSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceImpactTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  strategyOptionDesc: {
    fontSize: 12,
    opacity: 0.7,
    marginLeft: 26,
  },
  // Slider Styles
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginVertical: 8,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
  },
  sliderProgress: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    top: -9,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sliderThumbInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  // Slippage Section Styles
  slippageSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  slippageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slippageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  slippageValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F4A261',
  },
  slippageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  slippageLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  slippageDescription: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
  },
  // Cross-chain progress related styles
  progressContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '500',
  },
  txHash: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCurrent: {
    backgroundColor: '#2196F3',
  },
  stepCompleted: {
    backgroundColor: '#4CAF50',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 70,
  },
});
