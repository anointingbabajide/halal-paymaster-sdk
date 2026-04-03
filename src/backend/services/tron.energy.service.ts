// // ─── Tronsave Energy Rental Service ──────────────────────────────────────────
// // Rents energy from Tronsave marketplace before each sweep
// // User wallet executes transaction using rented energy — no TRX needed
// // Cost: ~5-8 TRX per USDT sweep (paid from your Tronsave internal balance)
// // Tronsave docs: https://docs.tronsave.io/developer/buy-resources-v2/use-api-key

// const TRONSAVE_API_URL = "https://api.tronsave.io";

// // energy needed per USDT TRC-20 transfer
// // 65,000 covers standard transfers, 131,000 for new/unactivated accounts
// const ENERGY_PER_USDT_TRANSFER = 65_000;
// const ENERGY_PER_NEW_ACCOUNT_TRANSFER = 131_000;

// // duration to rent energy — 1 hour is enough for a sweep
// const RENT_DURATION_SEC = 3600; // 1 hour

// export interface TronsaveOrderResult {
//   orderId: string;
//   energyAmount: number;
//   receiver: string;
// }

// // rent energy for a user wallet before sweep
// export const rentEnergyForSweep = async (
//   receiverAddress: string,
//   isNewAccount: boolean = false,
// ): Promise<TronsaveOrderResult> => {
//   const apiKey = process.env.TRONSAVE_API_KEY;
//   if (!apiKey) throw new Error("TRONSAVE_API_KEY not set in .env");

//   const energyAmount = isNewAccount
//     ? ENERGY_PER_NEW_ACCOUNT_TRANSFER
//     : ENERGY_PER_USDT_TRANSFER;

//   const response = await fetch(`${TRONSAVE_API_URL}/v2/buy-resource`, {
//     method: "POST",
//     headers: {
//       apikey: apiKey,
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       resourceType: "ENERGY",
//       unitPrice: "MEDIUM",
//       resourceAmount: energyAmount,
//       receiver: receiverAddress,
//       durationSec: RENT_DURATION_SEC,
//       options: {
//         allowPartialFill: false, // must get full amount
//         onlyCreateWhenFulfilled: true, // only rent if fully available
//         preventDuplicateIncompleteOrders: true,
//       },
//     }),
//   });

//   const result = await response.json();

//   if (result.error || !result.data?.orderId) {
//     throw new Error(`Tronsave energy rental failed: ${JSON.stringify(result)}`);
//   }

//   console.log(
//     `[Tronsave] Rented ${energyAmount} energy for ${receiverAddress} | order: ${result.data.orderId}`,
//   );

//   return {
//     orderId: result.data.orderId,
//     energyAmount,
//     receiver: receiverAddress,
//   };
// };

// // check Tronsave internal account balance
// // make sure you have enough TRX to cover rental costs
// export const getTronsaveBalance = async (): Promise<number> => {
//   const apiKey = process.env.TRONSAVE_API_KEY;
//   if (!apiKey) throw new Error("TRONSAVE_API_KEY not set in .env");

//   const response = await fetch(`${TRONSAVE_API_URL}/v2/user-info`, {
//     headers: { apikey: apiKey },
//   });

//   const result = await response.json();
//   if (result.error) {
//     throw new Error(
//       `Failed to get Tronsave balance: ${JSON.stringify(result)}`,
//     );
//   }

//   // balance is in SUN — convert to TRX
//   return result.data?.balance / 1_000_000 || 0;
// };

// // estimate cost before renting
// export const estimateEnergyCost = async (
//   energyAmount: number,
// ): Promise<number> => {
//   const apiKey = process.env.TRONSAVE_API_KEY;
//   if (!apiKey) throw new Error("TRONSAVE_API_KEY not set in .env");

//   const response = await fetch(`${TRONSAVE_API_URL}/v2/estimate-buy-resource`, {
//     method: "POST",
//     headers: {
//       apikey: apiKey,
//       "content-type": "application/json",
//     },
//     body: JSON.stringify({
//       resourceType: "ENERGY",
//       unitPrice: "MEDIUM",
//       resourceAmount: energyAmount,
//     }),
//   });

//   const result = await response.json();
//   // returns cost in SUN — convert to TRX
//   return result.data?.estimatedCost / 1_000_000 || 0;
// };
