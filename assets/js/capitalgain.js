/**
 * ============================================================================
 * CA Pro Tax Suite - Capital Gain Engine
 * ============================================================================
 * Purpose: Advanced asset tracking, FIFO calculations, Indexation, and
 * STCG/LTCG classification based on holding periods.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // We will inject a sub-menu or a modal to handle CG trades in a real app,
    // but here we expose the core Engine logic that the main computation uses.
    
    class CapitalGainEngine {
        
        /**
         * Initialize the engine with current FY Cost Inflation Index (CII)
         * Note: These should ideally come from the JSON rules file
         */
        constructor(fyRules) {
            this.rules = fyRules;
            // Simulated CII Table (Base Year 2001-02 = 100)
            this.ciiTable = {
                "2001-02": 100,
                "2010-11": 167,
                "2020-21": 301,
                "2023-24": 348,
                "2024-25": 363
            };
        }

        /**
         * Determine Holding Period and Classification
         * @param {string} assetType - 'Equity', 'Property', 'DebtFund'
         * @param {Date} buyDate 
         * @param {Date} sellDate 
         */
        getClassification(assetType, buyDate, sellDate) {
            const holdingMonths = (sellDate - buyDate) / (1000 * 60 * 60 * 24 * 30.44);
            
            let threshold = 36; // Default 3 years
            
            if (assetType === 'Equity' || assetType === 'EquityMutualFund') {
                threshold = 12;
            } else if (assetType === 'Property' || assetType === 'UnlistedShares') {
                threshold = 24;
            }

            return holdingMonths > threshold ? 'LTCG' : 'STCG';
        }

        /**
         * Calculate Indexed Cost of Acquisition (Property & Debt Funds pre-2023)
         */
        getIndexedCost(purchasePrice, buyFY, sellFY) {
            const buyCII = this.ciiTable[buyFY] || 100; // Cap at 2001 base
            const sellCII = this.ciiTable[sellFY] || this.ciiTable["2024-25"];
            
            return Math.round(purchasePrice * (sellCII / buyCII));
        }

        /**
         * FIFO (First-In-First-Out) Calculation for Shares/Mutual Funds
         * @param {Array} buyTransactions - Array of {date, qty, price} sorted by date asc
         * @param {Array} sellTransactions - Array of {date, qty, price} sorted by date asc
         * @returns {Object} { stcg, ltcg }
         */
        calculateFIFO(buyTransactions, sellTransactions, assetType) {
            let inventory = JSON.parse(JSON.stringify(buyTransactions)); // Deep copy
            let totalSTCG = 0;
            let totalLTCG = 0;

            for (let sale of sellTransactions) {
                let qtyToSell = sale.qty;
                const saleDate = new Date(sale.date);

                while (qtyToSell > 0 && inventory.length > 0) {
                    let batch = inventory[0];
                    let qtySoldFromBatch = Math.min(qtyToSell, batch.qty);
                    
                    const buyDate = new Date(batch.date);
                    const gain = (sale.price - batch.price) * qtySoldFromBatch;
                    const type = this.getClassification(assetType, buyDate, saleDate);
                    
                    // Grandfathering logic (Section 112A for equity bought before 31-Jan-2018)
                    // (Simplified here for structural demonstration)
                    let finalGain = gain;
                    if (assetType === 'Equity' && type === 'LTCG' && buyDate < new Date('2018-01-31')) {
                        // FMV logic would go here
                    }

                    if (type === 'LTCG') {
                        totalLTCG += finalGain;
                    } else {
                        totalSTCG += finalGain;
                    }

                    // Update quantities
                    qtyToSell -= qtySoldFromBatch;
                    batch.qty -= qtySoldFromBatch;

                    if (batch.qty === 0) {
                        inventory.shift(); // Remove empty batch
                    }
                }
            }

            return {
                stcg: totalSTCG,
                ltcg: totalLTCG,
                remainingInventory: inventory
            };
        }

        /**
         * Process a standard Property Sale
         */
        processPropertySale(salePrice, purchasePrice, expenses, buyFY, sellFY) {
            const indexedCost = this.getIndexedCost(purchasePrice, buyFY, sellFY);
            const netConsideration = salePrice - expenses;
            const ltcg = netConsideration - indexedCost;

            return {
                netConsideration,
                indexedCost,
                capitalGain: ltcg,
                type: 'LTCG' // Assuming holding > 24m based on passing FYs
            };
        }
    }

    // Expose globally for the main taxengine.js to utilize
    window.CGEngine = CapitalGainEngine;
});