import React, { useState } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import PreviewModal from '@/components/PreviewModal';
import SaffronAPI, { TradePreview, BridgePreview } from '@/api';

interface Transaction {
  id: string;
  type: 'trade' | 'transfer' | 'load_fund' | 'deposit' | 'withdraw' | 'unknown';
  description: string;
  amount?: number;
  recipient?: string;
  symbol?: string;
  chain?: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

export default function SaffronHomeScreen() {
  const colorScheme = useColorScheme();
  const [inputText, setInputText] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<TradePreview | BridgePreview | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null);
  
  const saffronAPI = new SaffronAPI();

  // Allowed tokens on Aptos perp DEX (example set; adjust as needed)
  const APTOS_PERP_TOKENS = new Set([
    'APT', 'BTC', 'ETH', 'SOL', 'SUI', 'ARB', 'AVAX', 'OP', 'DOGE', 'TON'
  ]);

  // Supported chains for USDC bridging
  const SUPPORTED_CHAINS = [
    'aptos', 'ethereum', 'eth', 'arbitrum', 'base', 'optimism', 'op', 'bsc', 'binance', 'polygon', 'matic',
    'avalanche', 'avax', 'solana', 'sui', 'zksync', 'zksync', 'linea', 'mantle', 'blast'
  ];

  const extractChain = (text: string): string | undefined => {
    const lower = text.toLowerCase();
    // try to capture after "from" or "to"
    const m = lower.match(/\b(?:from|to)\s+([a-zA-Z]+)/);
    const guess = m ? m[1] : undefined;
    const found = SUPPORTED_CHAINS.find(c => c === (guess ?? '').toLowerCase());
    return found ?? undefined;
  };

  const parseCommand = (text: string): Transaction => {
    const lowerText = text.toLowerCase();
    const id = Date.now().toString();
    const timestamp = new Date();
    
    // Extract amount using regex
    const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    
    // Trading on Aptos perp DEX (restrict to known tokens)
    if (lowerText.includes('trade') || lowerText.includes('buy') || lowerText.includes('sell')) {
      // Extract token symbol (1-5 uppercase letters)
      const symbolMatch = text.match(/\b([A-Z]{1,5})\b/);
      const symbol = symbolMatch ? symbolMatch[1] : undefined;

      // Validate against allowed tokens
      const validSymbol = symbol && APTOS_PERP_TOKENS.has(symbol.toUpperCase());

      return {
        id,
        type: validSymbol ? 'trade' : 'unknown',
        description: validSymbol ? text : `${text} (Unsupported token for Aptos perp DEX)`,
        amount,
        symbol: symbol?.toUpperCase(),
        timestamp,
        status: 'pending'
      };
    } else if (lowerText.includes('send') || lowerText.includes('transfer') || lowerText.includes('pay')) {
      // Extract recipient (simple pattern matching)
      const recipientMatch = text.match(/(?:to|send)\s+([a-zA-Z\s]+?)(?:\s|$)/i);
      const recipient = recipientMatch ? recipientMatch[1].trim() : undefined;
      
      return {
        id,
        type: 'transfer',
        description: text,
        amount,
        recipient,
        timestamp,
        status: 'pending'
      };
    } else if (lowerText.includes('deposit') || lowerText.includes('bridge in') || lowerText.includes('load')) {
      // Deposit USDC from other chains into Aptos
      // Fixed amount of 1 USDC (hardcoded cross-chain amount)
      // Only extract "from XXX", ignore "to XXX"
      const fromMatch = lowerText.match(/\bfrom\s+([a-zA-Z]+)/);
      const sourceChain = fromMatch
        ? (SUPPORTED_CHAINS.find(c => c === fromMatch[1].toLowerCase()) || 'base')
        : 'base'; // Default cross-chain from Base
      const fixedAmount = 1.0;
      return {
        id,
        type: 'deposit',
        description: `Deposit $${fixedAmount.toFixed(2)} USDC from ${sourceChain.charAt(0).toUpperCase() + sourceChain.slice(1)} to Aptos`,
        amount: fixedAmount,
        chain: sourceChain,
        timestamp,
        status: 'pending',
      };
    } else if (lowerText.includes('withdraw') || lowerText.includes('bridge out') || lowerText.includes('send usdc') || lowerText.includes('bridge')) {
      // Determine target chain
      const toMatch = lowerText.match(/\bto\s+([a-zA-Z]+)/);
      const targetChain = toMatch ? toMatch[1] : '';

      // If target is Aptos, understand as depositing from other chains to Aptos (Deposit)
      if (targetChain === 'aptos') {
        const fromMatch = lowerText.match(/\bfrom\s+([a-zA-Z]+)/);
        const sourceChain = fromMatch
          ? (SUPPORTED_CHAINS.find(c => c === fromMatch[1].toLowerCase()) || 'base')
          : 'base'; // Default cross-chain from Base
        const fixedAmount = 1.0;
        return {
          id,
          type: 'deposit',
          description: `Deposit $${fixedAmount.toFixed(2)} USDC from ${sourceChain.charAt(0).toUpperCase() + sourceChain.slice(1)} to Aptos`,
          amount: fixedAmount,
          chain: sourceChain,
          timestamp,
          status: 'pending',
        };
      } else {
        // Withdraw from Aptos to other chains
        const chain = extractChain(text) || 'ethereum';
        return {
          id,
          type: 'withdraw',
          description: `Withdraw USDC ${amount ? '$' + amount.toFixed(2) : ''} to ${chain}`,
          amount,
          chain,
          timestamp,
          status: 'pending',
        };
      }
    } else if (lowerText.includes('load fund') || lowerText.includes('add fund') || lowerText.includes('deposit fund')) {
      // Generic load funds (fallback)
      return {
        id,
        type: 'load_fund',
        description: text,
        amount,
        timestamp,
        status: 'pending'
      };
    }
    
    return {
      id,
      type: 'unknown',
      description: text,
      timestamp,
      status: 'failed'
    };
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    
    setIsProcessing(true);
    
    try {
      // Parse the command
      const transaction = parseCommand(inputText);
      
      // For unknown transactions, show error immediately
      if (transaction.type === 'unknown') {
        setIsProcessing(false);
        Alert.alert(
          'Error',
          'Sorry, I did not understand that. Try: "Buy 10 APT", "Sell 5 SOL", "Deposit $200 USDC from Arbitrum", or "Withdraw $50 USDC to Base".'
        );
        return;
      }
      
      // Generate preview for valid transactions
      let preview: TradePreview | BridgePreview | null = null;
      
      if (transaction.type === 'trade' && transaction.symbol && transaction.amount) {
        preview = await saffronAPI.getTradePreview(
          transaction.symbol,
          transaction.description.toLowerCase().includes('sell') ? 'sell' : 'buy',
          transaction.amount,
          undefined,
          transaction.description.toLowerCase().includes('limit') ? 'limit' : 'market'
        );
      } else if ((transaction.type === 'deposit' || transaction.type === 'withdraw') && transaction.amount && transaction.chain) {
        preview = await saffronAPI.getBridgePreview(
          transaction.type === 'deposit' ? transaction.chain : 'aptos',
          transaction.type === 'deposit' ? 'aptos' : transaction.chain,
          transaction.amount.toString()
        );
      }
      
      if (preview) {
        // Show preview modal
        setCurrentPreview(preview);
        setPendingTransaction(transaction);
        setShowPreview(true);
        setIsProcessing(false);
      } else {
        // For transfers and other types, process directly
        executeTransaction(transaction);
      }
      
      // Clear input
      setInputText('');
      
    } catch (error) {
      setIsProcessing(false);
      Alert.alert('Error', 'Failed to process command. Please try again.');
    }
  };

  const executeTransaction = (transaction: Transaction) => {
    // Add to transactions list
    setTransactions(prev => [transaction, ...prev]);
    
    // Simulate processing
    setTimeout(() => {
      setTransactions(prev => 
        prev.map(t => 
          t.id === transaction.id 
            ? { ...t, status: 'completed' }
            : t
        )
      );
      setIsProcessing(false);
    }, 2000);
    
    Alert.alert('Processing', `Your ${transaction.type.replace('_', ' ')} request is being processed.`);
  };

  const handleConfirmPreview = (strategy?: any) => {
    if (pendingTransaction) {
      setShowPreview(false);
      setIsProcessing(true);
      
      // Add strategy info to transaction if it's a trade
      const updatedTransaction = strategy && pendingTransaction.type === 'trade' 
        ? { ...pendingTransaction, description: `${pendingTransaction.description} (${strategy} strategy)` }
        : pendingTransaction;
      
      executeTransaction(updatedTransaction);
      setPendingTransaction(null);
      setCurrentPreview(null);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPendingTransaction(null);
    setCurrentPreview(null);
    setIsProcessing(false);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'trade': return 'chart.line.uptrend.xyaxis';
      case 'transfer': return 'paperplane.fill';
      case 'load_fund': return 'plus.circle.fill';
      case 'deposit': return 'arrow.down.circle.fill';
      case 'withdraw': return 'arrow.up.circle.fill';
      default: return 'questionmark.circle';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#F44336';
      default: return Colors[colorScheme ?? 'light'].text;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={[styles.title, { color: Colors[colorScheme ?? 'light'].tint }]}>Saffron</ThemedText>
          <ThemedText style={styles.subtitle}>Make your money work for you.</ThemedText>
        </ThemedView>

        {/* Input Section */}
        <ThemedView style={styles.inputSection}>
          <ThemedText type="subtitle" style={styles.inputLabel}>
            What would you like to do?
          </ThemedText>
          <ThemedView style={[styles.inputContainer, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
            <TextInput
              style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder="e.g., 'Buy 10 APT' · 'Sell 5 SOL' · 'Deposit $200 USDC from Arbitrum' · 'Withdraw $50 USDC to Base'"
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              multiline
              maxLength={200}
            />
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              onPress={handleSubmit}
              disabled={isProcessing || !inputText.trim()}
            >
              <IconSymbol 
                name={isProcessing ? "hourglass" : "leaf.fill"} 
                size={20} 
                color="#FFF8E1" 
              />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Suggestions */}
        <ThemedView style={styles.suggestionsSection}>
          <ThemedText style={styles.suggestionsTitle}>Try saying:</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
            {[
              'Buy 10 APT',
              'Sell 5 SOL',
              'Deposit $250 USDC from Arbitrum',
              'Withdraw $1 USDC to Aptos',
              'Transfer $25 to Alice'
            ].map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.suggestionChip, { borderColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={() => setInputText(suggestion)}
              >
                <ThemedText style={styles.suggestionText}>{suggestion}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ThemedView>

        {/* Transactions List */}
        <ThemedView style={styles.transactionsSection}>
          <ThemedText type="subtitle" style={styles.transactionsTitle}>Recent Activity</ThemedText>
          <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
            {transactions.length === 0 ? (
              <ThemedView style={styles.emptyState}>
                <IconSymbol name="tray" size={48} color={Colors[colorScheme ?? 'light'].tabIconDefault} />
                <ThemedText style={styles.emptyText}>No transactions yet</ThemedText>
                <ThemedText style={styles.emptySubtext}>Start by typing a command above</ThemedText>
              </ThemedView>
            ) : (
              transactions.map((transaction) => (
                <ThemedView key={transaction.id} style={[styles.transactionItem, { borderColor: Colors[colorScheme ?? 'light'].tabIconDefault }]}>
                  <ThemedView style={styles.transactionHeader}>
                    <IconSymbol 
                      name={getTransactionIcon(transaction.type)} 
                      size={20} 
                      color={Colors[colorScheme ?? 'light'].tint} 
                    />
                    <ThemedText style={styles.transactionType}>
                      {transaction.type.replace('_', ' ').toUpperCase()}
                    </ThemedText>
                    <ThemedView style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) }]}>
                      <ThemedText style={styles.statusText}>{transaction.status}</ThemedText>
                    </ThemedView>
                  </ThemedView>
                  <ThemedText style={styles.transactionDescription}>{transaction.description}</ThemedText>
                  {transaction.amount && (
                    <ThemedText style={styles.transactionAmount}>${transaction.amount.toFixed(2)}</ThemedText>
                  )}
                  <ThemedText style={styles.transactionTime}>
                    {transaction.timestamp.toLocaleTimeString()}
                  </ThemedText>
                </ThemedView>
              ))
            )}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
      
      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        preview={currentPreview}
        onConfirm={handleConfirmPreview}
        onCancel={handleCancelPreview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 4,
  },
  inputSection: {
    padding: 20,
    paddingTop: 10,
  },
  inputLabel: {
    marginBottom: 12,
    fontSize: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 16,
    padding: 4,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  suggestionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  suggestionsTitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  suggestionsScroll: {
    flexDirection: 'row',
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
  },
  transactionsSection: {
    flex: 1,
    padding: 20,
    paddingTop: 10,
  },
  transactionsTitle: {
    marginBottom: 16,
    fontSize: 18,
  },
  transactionsList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  transactionItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  transactionDescription: {
    fontSize: 16,
    marginBottom: 4,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
    opacity: 0.7,
  },
});
