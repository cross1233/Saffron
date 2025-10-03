#[test_only]
module cross_chain::liquidity_test {
    use std::signer;
    use std::debug;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::object;
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::primary_fungible_store;

    use cross_chain::liquidity_provider;

    // 测试常量
    const TEST_USDC_AMOUNT: u64 = 1000000;      // 10 USDC (假设6位小数)
    const TEST_APT_AMOUNT: u64 = 100000000;      // 1 APT (8位小数)
    const TEST_TICK_RANGE: u32 = 20;             // 20% 价格范围

    #[test(framework = @0x1, user = @0x123)]
    fun test_get_user_balances(framework: &signer, user: &signer) {
        // 初始化测试环境
        setup_test_environment(framework, user);

        let user_addr = signer::address_of(user);
        let (usdc_balance, apt_balance) = liquidity_provider::get_user_balances(user_addr);

        debug::print(&b"User USDC balance: ");
        debug::print(&usdc_balance);
        debug::print(&b"User APT balance: ");
        debug::print(&apt_balance);

        // 验证余额大于0
        assert!(apt_balance > 0, 1);
    }

    #[test(framework = @0x1, user = @0x123)]
    fun test_check_pool_exists(framework: &signer, user: &signer) {
        setup_test_environment(framework, user);

        let pool_exists_before = liquidity_provider::is_pool_exists();
        debug::print(&b"Pool exists before: ");
        debug::print(&pool_exists_before);

        // 初始状态下池子应该不存在
        assert!(!pool_exists_before, 2);
    }

    #[test(framework = @0x1, user = @0x123)]
    fun test_calculate_optimal_amounts(framework: &signer, user: &signer) {
        setup_test_environment(framework, user);

        let (liquidity, usdc_actual, apt_actual) = liquidity_provider::calculate_optimal_amounts(
            TEST_USDC_AMOUNT,
            TEST_APT_AMOUNT,
            TEST_TICK_RANGE
        );

        debug::print(&b"Expected liquidity: ");
        debug::print(&liquidity);
        debug::print(&b"Actual USDC amount: ");
        debug::print(&usdc_actual);
        debug::print(&b"Actual APT amount: ");
        debug::print(&apt_actual);

        // 验证计算结果合理
        assert!(usdc_actual <= TEST_USDC_AMOUNT, 3);
        assert!(apt_actual <= TEST_APT_AMOUNT, 4);
    }

    #[test(framework = @0x1, user = @0x123)]
    #[expected_failure(abort_code = 1002)] // E_INSUFFICIENT_APT_BALANCE
    fun test_insufficient_balance(framework: &signer, user: &signer) {
        setup_test_environment(framework, user);

        // 尝试添加超过余额的流动性
        liquidity_provider::add_usdc_apt_liquidity(
            user,
            TEST_USDC_AMOUNT,
            1000000000000,  // 远超过测试APT余额
            TEST_TICK_RANGE
        );
    }

    #[test(framework = @0x1, user = @0x123)]
    #[expected_failure(abort_code = 1003)] // E_INVALID_AMOUNTS
    fun test_invalid_amounts(framework: &signer, user: &signer) {
        setup_test_environment(framework, user);

        // 尝试添加0数量的流动性
        liquidity_provider::add_usdc_apt_liquidity(
            user,
            0,  // 无效的USDC数量
            TEST_APT_AMOUNT,
            TEST_TICK_RANGE
        );
    }

    // 测试环境设置函数
    fun setup_test_environment(framework: &signer, user: &signer) {
        // 初始化时间戳
        timestamp::set_time_has_started_for_testing(framework);

        let user_addr = signer::address_of(user);

        // 创建用户账户
        if (!account::exists_at(user_addr)) {
            account::create_account_for_test(user_addr);
        };

        // 初始化AptosCoin
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(framework);

        if (!coin::is_account_registered<AptosCoin>(user_addr)) {
            coin::register<AptosCoin>(user);
        };

        // 给用户一些测试APT
        let test_apt = coin::mint(TEST_APT_AMOUNT * 10, &mint_cap); // 10倍测试金额
        coin::deposit(user_addr, test_apt);

        // 清理能力
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        debug::print(&b"Test environment setup completed");
    }

    // 集成测试 - 需要在实际环境中运行
    #[test(framework = @0x1, user = @0x123)]
    fun test_pool_info(framework: &signer, user: &signer) {
        setup_test_environment(framework, user);

        let (current_tick, current_price) = liquidity_provider::get_pool_info();
        debug::print(&b"Current tick: ");
        debug::print(&current_tick);
        debug::print(&b"Current price: ");
        debug::print(&current_price);

        // 如果池子不存在，应该返回0
        if (!liquidity_provider::is_pool_exists()) {
            assert!(current_tick == 0, 5);
            assert!(current_price == 0, 6);
        };
    }
}