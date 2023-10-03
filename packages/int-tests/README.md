# Marginly integration tests

Generate types for contracts before start

```
yarn gen
```

## Run test

In order to run specific test, run command below and specify test name as "--suite" argument

```
yarn start --suite=suiteName
```

## Test suites
This paragraph describes int test scenarios and gives their `suiteName` which can be used in previously mentioned run test command.
### long
In this test scenario lots of long positions are created, then daily reinits happen in course of the year.
Tests long functionality and checks all the related calculations, including coefficient and system leverage updates.
Fails if some of those calculations go wrong.
Located in `src/suites/long.ts`
### short
In this test scenario lots of short positions are created, then daily reinits happen in course of the year.
Tests long functionality and checks all the related calculations, including coefficient and system leverage updates.
Fails if some of those calculations go wrong.
Located in `src/suites/short.ts`
### longAndShort
This test scenario is a union of `long` and `short` ones. Additionally tracks shorts and long balances changes.
Located in `src/suites/long_and_short.ts`
### longIncome
This test scenario simulates WETH price rise by 10% and logs long position income. 
Additionally checks closePosition call functionality.
Located in `src/suites/long_income.ts`
### shortIncome
This test scenario simulates WETH price drop by 10% and logs short position income. 
Additionally checks closePosition call functionality.
Located in `src/suites/long_income.ts`
### simulation1
Tests receivePosition functionality. Risky short position is created and then gets liquidated by the keeper.
Located in `src/suites/simulation.ts`
### simulation2
Tests receivePosition functionality. Risky long position is created and then gets liquidated by the keeper.
Located in `src/suites/simulation.ts`
### simulation3
Tests reinit call. Logs pool aggregates and parameters which can be analyzed later.
Located in `src/suites/simulation.ts`
### shortEmergency
Tests marginly pool set short emergency state and emergencyWithdraw calls. Fails if one of those calls reverts.
Located in `src/suites/shutdown.ts`
### longEmergency
Tests marginly pool set long emergency state and emergencyWithdraw calls. Fails if one of those calls reverts.
Located in `src/suites/shutdown.ts`
### deleveragePrecisionLong
In this test scenario liquidation of long position happens while all of the quote liquidity was taken by short positions.
As the result deleverage process is involved, which can lead to accumulation of calculation error.
Logs all pool aggregates, calculated and actual balances, which can be analyzed for errors accumulation later. 
Located in `src/suites/deleveragePrecision.ts`
### deleveragePrecisionLongCollateral
Previous test scenario, but partial deleverage of liquidated long position happens.
Logs all pool aggregates, calculated and actual balances, which can be analyzed for errors accumulation later.
Located in `src/suites/deleveragePrecision.ts`
### deleveragePrecisionLongReinit
Previous test scenario with additional monthly reinits in course of the year while nothing else happens,
so their effect on calculation errors can be analyzed.
Located in `src/suites/deleveragePrecision.ts`
### deleveragePrecisionShort
In this test scenario liquidation of short position happens while all of the base liquidity was taken by long positions.
As the result deleverage process is involved, which can lead to accumulation of calculation error.
Logs all pool aggregates, calculated and actual balances, which can be analyzed for errors accumulation later. 
Located in `src/suites/deleveragePrecision.ts`
### deleveragePrecisionShortCollateral
Previous test scenario, but partial deleverage of liquidated short position happens.
Logs all pool aggregates, calculated and actual balances, which can be analyzed for errors accumulation later.
Located in `src/suites/deleveragePrecision.ts`
### deleveragePrecisionShortReinit
Previous test scenario with additional monthly reinits in course of the year while nothing else happens,
so their effect on calculation errors can be analyzed.
Located in `src/suites/deleveragePrecision.ts`
### balanceSync
Tests balance sync after erc20 transfer (without marginly deposit call).
As the result calculated and actual (erc20 `balanceOf` method) balances differ.
Checks if the calculated balances match with the actual ones after the sync.
Located in `src/suites/balanceSync.ts`
### balanceSyncWithdrawBase
Tests balance sync after erc20 transfer (without marginly deposit call) and marginly WithdrawBase call.
As the result calculated base balance becomes negative, though the actual (erc20 `balanceOf` method) one is gte 0.
Checks if balance sync fixes this discrepancy.
Located in `src/suites/balanceSync.ts`
### balanceSyncWithdrawQuote
Tests balance sync after erc20 transfer (without marginly deposit call) and marginly WithdrawQuote call.
As the result calculated quote balance becomes negative, though the actual (erc20 `balanceOf` method) one is gte 0.
Checks if balance sync fixes this discrepancy.
Located in `src/suites/balanceSync.ts`
### routerSwaps
Tests both types of router swaps on DEXs which are available in Ethereum network. 
Checks balances of both pool and swapper before and after the swap, fails if deltas don't match.
Located in `src/suites/router.ts`
### routerMultipleSwaps
Tests both types of router swaps with splits between 2 randomly chosen DEXs and ratios.
Checks balances of both pool and swapper before and after the swap, fails if deltas don't match.
Located in `src/suites/router.ts`