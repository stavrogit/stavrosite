document.addEventListener('DOMContentLoaded', () => {

    // --- autoNumeric Initialization ---
    const currencyOptions = {
        currencySymbol: '$',
        suffixText: '',
        digitGroupSeparator: ',',
        decimalCharacter: '.',
        decimalPlaces: 0,
    };
    const percentOptions = {
        currencySymbol: '',
        suffixText: '%',
        decimalPlaces: 2,
        minimumValue: 0
    };

    const anInputs = {
        purchasePrice: new AutoNumeric('#purchase-price', currencyOptions),
        downPayment: new AutoNumeric('#down-payment', percentOptions),
        interestRate: new AutoNumeric('#interest-rate', percentOptions),
        closingCosts: new AutoNumeric('#closing-costs', { ...currencyOptions, decimalPlaces: 2 }), // Allow decimals for percent input
        renovationCosts: new AutoNumeric('#renovation-costs', currencyOptions),
        propertyTaxes: new AutoNumeric('#property-taxes', currencyOptions),
        insurance: new AutoNumeric('#insurance', currencyOptions),
        rentalIncome: new AutoNumeric('#rental-income', currencyOptions),
        annualMaintenanceCapex: new AutoNumeric('#annual-maintenance-capex', currencyOptions),
        managementFees: new AutoNumeric('#management-fees', currencyOptions),
    };
    
    const standardInputs = {
        loanPeriod: document.getElementById('loan-period'),
        closingCostsType: document.getElementById('closing-costs-type'),
        renovationPeriod: document.getElementById('renovation-period'),
        propertyTaxesType: document.getElementById('property-taxes-type'),
        insuranceType: document.getElementById('insurance-type'),
        vacancyMonths: document.getElementById('vacancy-months'),
    };

    // --- Event Listeners ---
    for (const key in anInputs) {
        anInputs[key].domElement.addEventListener('autoNumeric:rawValueModified', calculateAndDisplay);
    }
    for (const key in standardInputs) {
        standardInputs[key].addEventListener('input', calculateAndDisplay);
    }
    
    standardInputs.closingCostsType.addEventListener('change', (e) => {
        anInputs.closingCosts.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
    });
    standardInputs.propertyTaxesType.addEventListener('change', (e) => {
        anInputs.propertyTaxes.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
    });
    standardInputs.insuranceType.addEventListener('change', (e) => {
        anInputs.insurance.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
    });

    document.getElementById('calculate-btn').addEventListener('click', calculateAndDisplay);

    function calculateAndDisplay() {
        // --- Get input values ---
        const purchasePrice = anInputs.purchasePrice.getNumber() || 0;
        const downPaymentPercent = anInputs.downPayment.getNumber() || 0;
        const interestRatePercent = anInputs.interestRate.getNumber() || 0;
        const loanPeriod = parseInt(standardInputs.loanPeriod.value) || 30;
        const closingCostsValue = anInputs.closingCosts.getNumber() || 0;
        const closingCostsType = standardInputs.closingCostsType.value;
        const renovationCosts = anInputs.renovationCosts.getNumber() || 0;
        const renovationPeriod = parseFloat(standardInputs.renovationPeriod.value) || 0;
        const annualPropertyTaxesValue = anInputs.propertyTaxes.getNumber() || 0;
        const propertyTaxesType = standardInputs.propertyTaxesType.value;
        const annualInsuranceValue = anInputs.insurance.getNumber() || 0;
        const insuranceType = standardInputs.insuranceType.value;
        const monthlyRentalIncome = anInputs.rentalIncome.getNumber() || 0;
        const vacancyMonths = parseFloat(standardInputs.vacancyMonths.value) || 0;
        const annualMaintenanceCapex = anInputs.annualMaintenanceCapex.getNumber() || 0;
        const monthlyManagementFees = anInputs.managementFees.getNumber() || 0;

        // --- Calculations ---
        const downPayment = purchasePrice * (downPaymentPercent / 100);
        const loanAmount = purchasePrice - downPayment;
        
        const closingCosts = closingCostsType === 'percent' ? purchasePrice * (closingCostsValue / 100) : closingCostsValue;

        const monthlyInterestRate = (interestRatePercent / 100) / 12;
        const numberOfPayments = loanPeriod * 12;

        const monthlyMortgagePayment = loanAmount > 0 && monthlyInterestRate > 0 
            ? loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
            : 0;

        const annualPropertyTaxes = propertyTaxesType === 'percent' ? purchasePrice * (annualPropertyTaxesValue / 100) : annualPropertyTaxesValue;
        const monthlyTaxes = annualPropertyTaxes / 12;

        const annualInsurance = insuranceType === 'percent' ? purchasePrice * (annualInsuranceValue / 100) : annualInsuranceValue;
        const monthlyInsurance = annualInsurance / 12;

        const totalMonthlyMortgagePITI = monthlyMortgagePayment + monthlyTaxes + monthlyInsurance;
        
        const monthlyMaintenanceAndCapex = annualMaintenanceCapex / 12;
        
        // This carrying cost now includes maintenance/capex
        const upfrontExpenses = (totalMonthlyMortgagePITI + monthlyMaintenanceAndCapex) * renovationPeriod;
        const totalInitialInvestment = downPayment + closingCosts + renovationCosts + upfrontExpenses;

        const effectiveMonthlyRentalIncome = monthlyRentalIncome * (1 - (vacancyMonths / 12));
        const vacancyLoss = monthlyRentalIncome - effectiveMonthlyRentalIncome;

        const totalMonthlyExpenses = totalMonthlyMortgagePITI + monthlyMaintenanceAndCapex + monthlyManagementFees;

        const monthlyCashFlow = effectiveMonthlyRentalIncome - totalMonthlyExpenses;
        const annualCashFlow = monthlyCashFlow * 12;

        const cashOnCashROI = totalInitialInvestment > 0 ? (annualCashFlow / totalInitialInvestment) * 100 : 0;

        // --- Display Result ---
        const resultElement = document.getElementById('result');
        if (isFinite(cashOnCashROI) && totalInitialInvestment > 0) {
            resultElement.textContent = `Your estimated Cash-on-Cash ROI is: ${cashOnCashROI.toFixed(2)}%`;
        } else {
            resultElement.textContent = 'Please fill in all fields with valid numbers to calculate the ROI.';
        }
        
        // --- Update Summary Table ---
        updateSummaryTable({
            'Purchase Price': purchasePrice,
            'Down Payment': downPayment,
            'Closing Costs': closingCosts,
            'Renovation Costs': renovationCosts,
            'Upfront Renovation Period (Months)': renovationPeriod,
            'Mortgage carrying cost (during renovation)': upfrontExpenses,
            'Total Initial Investment': totalInitialInvestment,
            'Loan Amount': loanAmount,
            'Loan Period (Years)': loanPeriod,
            'Total Monthly Mortgage Payment (PITI)': totalMonthlyMortgagePITI,
            'Monthly Taxes': monthlyTaxes,
            'Monthly Insurance': monthlyInsurance,
            'Monthly Maintenance + CapEx': monthlyMaintenanceAndCapex,
            'Monthly Management': monthlyManagementFees,
            'Total Monthly Expenses (Post-Reno)': totalMonthlyExpenses,
            'Gross Monthly Rental Income': monthlyRentalIncome,
            'Vacancy Loss (-)': vacancyLoss,
            'Monthly Cash Flow (Post-Reno)': monthlyCashFlow,
            'Annual Cash Flow (Post-Reno)': annualCashFlow,
            'Cash-on-Cash ROI (%)': cashOnCashROI
        });
    }

    function updateSummaryTable(data) {
        const tableBody = document.querySelector('#summary-table tbody');
        tableBody.innerHTML = ''; 

        const boldKeys = [
            'Total Monthly Mortgage Payment (PITI)',
            'Monthly Cash Flow (Post-Reno)',
            'Annual Cash Flow (Post-Reno)',
            'Cash-on-Cash ROI (%)'
        ];

        for (const [key, value] of Object.entries(data)) {
            const row = tableBody.insertRow();
            const cell1 = row.insertCell(0);
            const cell2 = row.insertCell(1);

            if (boldKeys.includes(key)) {
                cell1.classList.add('summary-label-bold');
            }

            if (key === 'Cash-on-Cash ROI (%)') {
                cell1.innerHTML = `
                    <div class="tooltip">
                        ${key} <span class="info-icon">ⓘ</span>
                        <div class="tooltip-text">
                            <b>What is Cash-on-Cash Return?</b><br>
                            It measures the annual cash income relative to the actual cash you invested. It's a key metric for evaluating the performance of your invested capital.
                            <br><br>
                            <b>How It's Calculated:</b><br>
                            (Annual Cash Flow / Total Initial Investment) x 100
                        </div>
                    </div>
                `;
            } else {
                cell1.textContent = key;
            }
            
            if (key.includes('%')) {
                 cell2.textContent = `${(value || 0).toFixed(2)}%`;
            } else if (key.includes('Years') || key.includes('Months')) {
                cell2.textContent = value || 0;
            } else {
                 cell2.textContent = formatCurrency(value || 0);
            }
        }
    }

    function formatCurrency(value) {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    // Trigger update for default closing cost type
    standardInputs.closingCostsType.dispatchEvent(new Event('change'));

    // Initial calculation on page load
    calculateAndDisplay();
});