import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface PortfolioItem {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  change: number;
  changePercent: number;
}

interface AccountBalance {
  cash: number;
  invested: number;
  total: number;
}

export default function PortfolioScreen() {
  const colorScheme = useColorScheme();
  
  // Mock data - in a real app this would come from an API
  const accountBalance: AccountBalance = {
    cash: 2500.00,
    invested: 12750.50,
    total: 15250.50
  };
  
  const portfolio: PortfolioItem[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      shares: 25,
      currentPrice: 185.20,
      change: 2.15,
      changePercent: 1.17
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc.',
      shares: 10,
      currentPrice: 245.80,
      change: -5.30,
      changePercent: -2.11
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      shares: 15,
      currentPrice: 378.90,
      change: 8.45,
      changePercent: 2.28
    },
    {
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      shares: 8,
      currentPrice: 142.65,
      change: -1.25,
      changePercent: -0.87
    }
  ];

  const getChangeColor = (change: number) => {
    return change >= 0 ? '#4CAF50' : '#F44336';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={[styles.title, { color: Colors[colorScheme ?? 'light'].tint }]}>Portfolio</ThemedText>
          <ThemedText style={styles.subtitle}>Your investment overview</ThemedText>
        </ThemedView>

        {/* Account Balance Card */}
        <ThemedView style={[styles.balanceCard, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
          <ThemedView style={styles.balanceHeader}>
            <IconSymbol name="dollarsign.circle.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText type="subtitle" style={styles.balanceTitle}>Account Balance</ThemedText>
          </ThemedView>
          
          <ThemedText style={styles.totalBalance}>${accountBalance.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</ThemedText>
          
          <ThemedView style={styles.balanceBreakdown}>
            <ThemedView style={styles.balanceItem}>
              <ThemedText style={styles.balanceLabel}>Cash</ThemedText>
              <ThemedText style={styles.balanceValue}>${accountBalance.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.balanceItem}>
              <ThemedText style={styles.balanceLabel}>Invested</ThemedText>
              <ThemedText style={styles.balanceValue}>${accountBalance.invested.toLocaleString('en-US', { minimumFractionDigits: 2 })}</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Holdings Section */}
        <ThemedView style={styles.holdingsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Holdings</ThemedText>
          
          {portfolio.map((item) => (
            <ThemedView key={item.symbol} style={[styles.holdingItem, { borderColor: Colors[colorScheme ?? 'light'].tabIconDefault }]}>
              <ThemedView style={styles.holdingHeader}>
                <ThemedView style={styles.holdingInfo}>
                  <ThemedText style={styles.holdingSymbol}>{item.symbol}</ThemedText>
                  <ThemedText style={styles.holdingName}>{item.name}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.holdingPrice}>
                  <ThemedText style={styles.currentPrice}>${item.currentPrice.toFixed(2)}</ThemedText>
                  <ThemedView style={styles.changeContainer}>
                    <IconSymbol 
                      name={item.change >= 0 ? "arrow.up.right" : "arrow.down.right"} 
                      size={12} 
                      color={getChangeColor(item.change)} 
                    />
                    <ThemedText style={[styles.changeText, { color: getChangeColor(item.change) }]}>
                      {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)} ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
              
              <ThemedView style={styles.holdingDetails}>
                <ThemedText style={styles.sharesText}>{item.shares} shares</ThemedText>
                <ThemedText style={styles.valueText}>
                  ${(item.shares * item.currentPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>

        {/* Quick Actions */}
        <ThemedView style={styles.actionsSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Quick Actions</ThemedText>
          
          <ThemedView style={styles.actionButtons}>
            <ThemedView style={[styles.actionButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
              <IconSymbol name="plus.circle" size={24} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.actionText}>Add Funds</ThemedText>
            </ThemedView>
            
            <ThemedView style={[styles.actionButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
              <IconSymbol name="chart.line.uptrend.xyaxis" size={24} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.actionText}>Buy Stocks</ThemedText>
            </ThemedView>
            
            <ThemedView style={[styles.actionButton, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
              <IconSymbol name="arrow.up.doc" size={24} color={Colors[colorScheme ?? 'light'].tint} />
              <ThemedText style={styles.actionText}>Statements</ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
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
  balanceCard: {
    margin: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceTitle: {
    marginLeft: 8,
    fontSize: 18,
  },
  totalBalance: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#4CAF50',
  },
  balanceBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  holdingsSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  holdingItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  holdingInfo: {
    flex: 1,
  },
  holdingSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  holdingName: {
    fontSize: 14,
    opacity: 0.7,
  },
  holdingPrice: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  holdingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sharesText: {
    fontSize: 14,
    opacity: 0.7,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsSection: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
