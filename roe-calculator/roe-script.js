document.addEventListener('DOMContentLoaded', () => {

    // --- AutoNumeric Options ---
    const currencyOptions = { digitGroupSeparator: ',', decimalCharacter: '.', decimalPlaces: 0 };
    const percentOptions = { suffixText: '%', decimalPlaces: 2, minimumValue: 0 };

    // --- Initialize AutoNumeric on Inputs ---
    const anInputs = {
        marketValue: new AutoNumeric('#market-value', currencyOptions),
        purchasePrice: new AutoNumeric('#purchase-price', currencyOptions),
        improvements: new AutoNumeric('#improvements', currencyOptions),
        loanAmount: new AutoNumeric('#loan-amount', currencyOptions),
        interestRate: new AutoNumeric('#interest-rate', percentOptions),
        annualRent: new AutoNumeric('#annual-rent', currencyOptions),
        propertyTaxes: new AutoNumeric('#property-taxes', currencyOptions),
        insurance: new AutoNumeric('#insurance', currencyOptions),
        maintenanceCapex: new AutoNumeric('#maintenance-capex', currencyOptions),
        managementFees: new AutoNumeric('#management-fees', currencyOptions),
        otherExpenses: new AutoNumeric('#other-expenses', currencyOptions),
        propertyAppreciation: new AutoNumeric('#property-appreciation', percentOptions),
        rentAppreciation: new AutoNumeric('#rent-appreciation', percentOptions),
        sellingCosts: new AutoNumeric('#selling-costs', percentOptions),
        taxRate: new AutoNumeric('#tax-rate', percentOptions),
        alternativeReturn: new AutoNumeric('#alternative-return', percentOptions),
    };

    // --- Add Event Listeners to all inputs ---
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', calculate);
        input.addEventListener('autoNumeric:rawValueModified', calculate);
    });
    
    // --- Toggle for Management Fees ---
    document.getElementById('management-fees-type').addEventListener('change', (e) => {
        anInputs.managementFees.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
        calculate();
    });

    // --- Main Calculation Function ---
    function calculate() {
        // --- Get All Input Values ---
        const M = {
            marketValue: anInputs.marketValue.getNumber() || 0,
            purchasePrice: anInputs.purchasePrice.getNumber() || 0,
            improvements: anInputs.improvements.getNumber() || 0,
            loanAmount: anInputs.loanAmount.getNumber() || 0,
            interestRate: anInputs.interestRate.getNumber() || 0,
            loanTerm: parseFloat(document.getElementById('loan-term').value) || 30,
            loanStartDate: document.getElementById('loan-start-date').value,
            annualRent: anInputs.annualRent.getNumber() || 0,
            propertyTaxes: anInputs.propertyTaxes.getNumber() || 0,
            insurance: anInputs.insurance.getNumber() || 0,
            maintenanceCapex: anInputs.maintenanceCapex.getNumber() || 0,
            managementFees: anInputs.managementFees.getNumber() || 0,
            managementFeesType: document.getElementById('management-fees-type').value,
            otherExpenses: anInputs.otherExpenses.getNumber() || 0,
            propertyAppreciation: anInputs.propertyAppreciation.getNumber() / 100 || 0,
            rentAppreciation: anInputs.rentAppreciation.getNumber() / 100 || 0,
            sellingCosts: anInputs.sellingCosts.getNumber() / 100 || 0,
            taxRate: anInputs.taxRate.getNumber() / 100 || 0,
            alternativeReturn: anInputs.alternativeReturn.getNumber() / 100 || 0,
        };

        // --- Amortization Calculation ---
        const { remainingBalance, principalPaidNext12Months, interestPaidNext12Months } = calculateAmortization(M.loanAmount, M.interestRate, M.loanTerm, M.loanStartDate);
        
        // --- KEEPING SCENARIO ---
        const currentEquity = M.marketValue - remainingBalance;
        const managementFeeAmount = M.managementFeesType === 'percent' ? M.annualRent * (M.managementFees / 100) : M.managementFees;
        const totalAnnualOperatingExpenses = M.propertyTaxes + M.insurance + M.maintenanceCapex + managementFeeAmount + M.otherExpenses;
        
        const projectedAnnualRent = M.annualRent * (1 + M.rentAppreciation);
        const projectedCashFlow = projectedAnnualRent - totalAnnualOperatingExpenses - interestPaidNext12Months;
        
        const appreciationGain = M.marketValue * M.propertyAppreciation;
        const totalGainFromKeeping = projectedCashFlow + principalPaidNext12Months + appreciationGain;
        const returnOnEquity = currentEquity > 0 ? (totalGainFromKeeping / currentEquity) : 0;

        // --- SELLING SCENARIO ---
        const sellingCostsAmount = M.marketValue * M.sellingCosts;
        const saleBasis = M.purchasePrice + M.improvements;
        const taxableGain = M.marketValue - saleBasis;
        const capitalGainsTax = taxableGain > 0 ? taxableGain * M.taxRate : 0;
        
        const netProceeds = M.marketValue - remainingBalance - sellingCostsAmount - capitalGainsTax;
        const gainFromSelling = netProceeds * M.alternativeReturn;

        // --- Update UI ---
        updateUI({
            totalGainFromKeeping,
            projectedCashFlow,
            principalPaidNext12Months,
            appreciationGain,
            returnOnEquity,
            gainFromSelling,
            netProceeds,
            grossProceeds: M.marketValue,
            loanPayoff: remainingBalance,
            saleExpenses: sellingCostsAmount,
            capGainsTax: capitalGainsTax,
        });
    }

    // --- Amortization Helper ---
    function calculateAmortization(principal, annualRate, termYears, startDate) {
        if (!principal || !annualRate || !termYears || !startDate) return { remainingBalance: principal, principalPaidNext12Months: 0, interestPaidNext12Months: 0 };

        const monthlyRate = (annualRate / 100) / 12;
        const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termYears);
        
        const start = new Date(startDate);
        const today = new Date();
        let monthsPassed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
        monthsPassed = Math.max(0, monthsPassed);

        let balance = principal;
        for (let i = 0; i < monthsPassed; i++) {
            const interest = balance * monthlyRate;
            balance -= (monthlyPayment - interest);
        }

        let principalPaidNext12Months = 0;
        let interestPaidNext12Months = 0;
        let futureBalance = balance;
        for (let i = 0; i < 12; i++) {
             if (futureBalance <= 0) break;
            const interest = futureBalance * monthlyRate;
            const principalPayment = monthlyPayment - interest;
            interestPaidNext12Months += interest;
            principalPaidNext12Months += principalPayment;
            futureBalance -= principalPayment;
        }
        
        return { remainingBalance: Math.max(0, balance), principalPaidNext12Months, interestPaidNext12Months };
    }
    
    function calculateMonthlyPayment(principal, annualRate, termYears) {
         if (!principal || !annualRate || !termYears) return 0;
        const monthlyRate = (annualRate / 100) / 12;
        const totalPayments = termYears * 12;
        const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
        return isFinite(payment) ? payment : 0;
    }

    // --- UI Update Helper ---
    function updateUI(data) {
        const formatCurrency = (val) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;

        document.getElementById('gain-from-keeping').textContent = formatCurrency(data.totalGainFromKeeping);
        document.getElementById('detail-cash-flow').textContent = formatCurrency(data.projectedCashFlow);
        document.getElementById('detail-principal-paid').textContent = formatCurrency(data.principalPaidNext12Months);
        document.getElementById('detail-appreciation').textContent = formatCurrency(data.appreciationGain);
        document.getElementById('detail-roe').textContent = formatPercent(data.returnOnEquity);
        
        document.getElementById('gain-from-selling').textContent = formatCurrency(data.gainFromSelling);
        document.getElementById('detail-gross-proceeds').textContent = formatCurrency(data.grossProceeds);
        document.getElementById('detail-loan-payoff').textContent = formatCurrency(data.loanPayoff);
        document.getElementById('detail-sale-expenses').textContent = formatCurrency(data.saleExpenses);
        document.getElementById('detail-cap-gains-tax').textContent = formatCurrency(data.capGainsTax);
        document.getElementById('detail-net-proceeds').textContent = formatCurrency(data.netProceeds);
    }
    
    // Initial calculation on load
    calculate();
});