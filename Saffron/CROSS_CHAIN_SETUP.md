# 跨链功能配置指南

## 📋 概述

Saffron App 集成了 Base Sepolia → Aptos Testnet 的 USDC 跨链功能，基于 Circle CCTP 协议实现。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd Saffron
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的私钥和地址：

```bash
# Base Sepolia 私钥
BASE_PRIVATE_KEY=0xYOUR_BASE_PRIVATE_KEY

# Aptos Testnet 私钥（去掉0x前缀）
APTOS_PRIVATE_KEY=YOUR_APTOS_PRIVATE_KEY

# Aptos 接收地址
APTOS_RECIPIENT=0xYOUR_APTOS_ADDRESS
```

### 3. 获取测试代币

#### Base Sepolia USDC
1. 访问 [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. 获取测试 ETH（用于 Gas 费）
3. 获取测试 USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

#### Aptos Testnet APT
```bash
aptos account fund-with-faucet --account YOUR_APTOS_ADDRESS
```

### 4. 运行应用

```bash
npm start
```

## 📖 使用方法

### 触发跨链

在应用中输入以下命令之一：

```
Deposit $100 USDC from Base
Bridge $50 USDC from Base to Aptos
Load $200 USDC from Base
```

**注意：** 虽然用户可以输入任意金额，但实际跨链金额固定为 **$3.00 USDC**。

### 跨链流程

1. **输入命令** → 显示预览弹窗
2. **点击 "Start Bridge"** → 开始跨链
3. **实时进度显示**:
   - Step 1/3: Base 链烧毁 USDC (约 10秒)
   - Step 2/3: Circle 签名验证 (约 10-15秒)
   - Step 3/3: Aptos 链接收 USDC (约 5-10秒)
4. **跨链完成** → 显示成功通知

总耗时约 **25-35秒**。

## 🔧 技术架构

### 文件结构

```
Saffron/
├── api/
│   └── cross-chain/
│       ├── config.ts              # 配置文件（写死的参数）
│       ├── base-sender.ts         # Base链发送器
│       ├── circle-attestation.ts  # Circle签名服务
│       ├── aptos-receiver.ts      # Aptos接收器
│       └── index.ts               # 主入口（executeCrossChain）
├── components/
│   └── PreviewModal.tsx           # 预览弹窗（含进度显示）
├── app/(tabs)/
│   └── index.tsx                  # 首页（命令解析）
├── .env                           # 环境变量（私钥）
└── package.json                   # 依赖配置
```

### 核心流程

```typescript
// 1. 用户输入命令
"Deposit $100 USDC from Base"

// 2. 解析命令（固定金额为 3 USDC）
const transaction = {
  type: 'deposit',
  amount: 3.0,  // 固定值
  chain: 'base'
}

// 3. 显示预览
preview = {
  sourceChain: 'base',
  destinationChain: 'aptos',
  amount: '3.0'
}

// 4. 用户点击 "Start Bridge"
await executeCrossChain((progress) => {
  // 实时更新进度
  console.log(progress.step, progress.message);
});

// 5. 跨链完成
result = {
  success: true,
  baseTxHash: '0x...',
  aptosTxHash: '0x...',
  usdcAmount: '3.0'
}
```

## ⚙️ 配置说明

### 固定参数（在 `api/cross-chain/config.ts` 中）

```typescript
export const CROSS_CHAIN_CONFIG = {
  USDC_AMOUNT: '3.0',  // 固定跨链金额

  BASE_SEPOLIA: {
    rpcUrl: 'https://sepolia.base.org',
    contracts: {
      tokenMessengerV2: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    }
  },

  APTOS_TESTNET: {
    rpcUrl: 'https://fullnode.testnet.aptoslabs.com',
    objects: {
      usdc: '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832'
    }
  }
};
```

## 🐛 故障排除

### 1. 找不到模块 'ethers'

```bash
npm install ethers @aptos-labs/ts-sdk react-native-get-random-values
```

### 2. 跨链失败

检查：
- Base 钱包是否有足够的 USDC（至少 3 USDC）
- Base 钱包是否有足够的 ETH（Gas 费）
- Aptos 地址格式是否正确（0x + 64位十六进制）
- 网络连接是否正常

### 3. Circle 签名超时

Circle attestation 通常需要 10-60秒，如果超时：
- 检查网络连接
- 等待几分钟后再试
- 确认 Base 交易已成功上链

## 📚 相关文档

- [Circle CCTP 文档](https://developers.circle.com/stablecoins/docs/cctp-technical-reference)
- [Base 开发者文档](https://docs.base.org/)
- [Aptos 开发者文档](https://aptos.dev/)
- [Saffron-contract 仓库](../Saffron-contract/)

## ⚠️ 注意事项

1. **仅用于测试网**：当前配置仅支持 Base Sepolia 和 Aptos Testnet
2. **私钥安全**：不要将 `.env` 文件提交到 Git
3. **固定金额**：实际跨链金额固定为 3 USDC，用户输入的金额仅用于显示
4. **React Native 限制**：由于 RN 环境限制，Aptos 接收部分使用了简化实现

## 💡 未来改进

- [ ] 支持用户自定义跨链金额
- [ ] 支持更多链（Ethereum、Arbitrum、Polygon等）
- [ ] 添加跨链历史记录
- [ ] 实现真实的 Aptos Move 脚本调用
- [ ] 添加交易状态查询功能
