// File: script.js (REVISED)
document.addEventListener('DOMContentLoaded', () => {

    // --- autoNumeric Initialization ---
    // Define options for currency and percentage fields
    const currencyOptions = {
        currencySymbol: '$',
        digitGroupSeparator: ',',
        decimalCharacter: '.',
        decimalPlaces: 0,
    };
    const percentOptions = {
        suffixText: '%',
        decimalPlaces: 2,
        minimumValue: 0
    };

    // Create a map to hold the AutoNumeric instances
    const anInputs = {
        purchasePrice: new AutoNumeric('#purchase-price', currencyOptions),
        downPayment: new AutoNumeric('#down-payment', percentOptions),
        interestRate: new AutoNumeric('#interest-rate', percentOptions),
        renovationCosts: new AutoNumeric('#renovation-costs', currencyOptions),
        propertyTaxes: new AutoNumeric('#property-taxes', currencyOptions), // Default, can be overridden
        insurance: new AutoNumeric('#insurance', currencyOptions), // Default, can be overridden
        rentalIncome: new AutoNumeric('#rental-income', currencyOptions),
        maintenance: new AutoNumeric('#maintenance', currencyOptions),
        managementFees: new AutoNumeric('#management-fees', currencyOptions),
    };
    
    // Also get the standard, non-formatted inputs
    const standardInputs = {
        renovationPeriod: document.getElementById('renovation-period'),
        propertyTaxesType: document.getElementById('property-taxes-type'),
        insuranceType: document.getElementById('insurance-type'),
    };

    // --- Event Listeners ---
    // Listen for changes on all autoNumeric inputs
    for (const key in anInputs) {
        anInputs[key].domElement.addEventListener('autoNumeric:rawValueModified', calculateAndDisplay);
    }
    // Listen for changes on standard inputs
    for (const key in standardInputs) {
        standardInputs[key].addEventListener('input', calculateAndDisplay);
    }
    
    // Add logic to toggle formatting for taxes and insurance
    standardInputs.propertyTaxesType.addEventListener('change', (e) => {
        anInputs.propertyTaxes.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
    });
    standardInputs.insuranceType.addEventListener('change', (e) => {
        anInputs.insurance.update(e.target.value === 'percent' ? percentOptions : currencyOptions);
    });

    document.getElementById('calculate-btn').addEventListener('click', calculateAndDisplay);

    function calculateAndDisplay() {
        // --- Get input values using autoNumeric's .getNumber() method ---
        const purchasePrice = anInputs.purchasePrice.getNumber() || 0;
        const downPaymentPercent = anInputs.downPayment.getNumber() || 0;
        const interestRatePercent = anInputs.interestRate.getNumber() || 0;
        const renovationCosts = anInputs.renovationCosts.getNumber() || 0;
        const renovationPeriod = parseFloat(standardInputs.renovationPeriod.value) || 0;
        const annualPropertyTaxesValue = anInputs.propertyTaxes.getNumber() || 0;
        const propertyTaxesType = standardInputs.propertyTaxesType.value;
        const annualInsuranceValue = anInputs.insurance.getNumber() || 0;
        const insuranceType = standardInputs.insuranceType.value;
        const monthlyRentalIncome = anInputs.rentalIncome.getNumber() || 0;
        const monthlyMaintenance = anInputs.maintenance.getNumber() || 0;
        const monthlyManagementFees = anInputs.managementFees.getNumber() || 0;

        // --- Calculations (These remain the same) ---
        const downPayment = purchasePrice * (downPaymentPercent / 100);
        const loanAmount = purchasePrice - downPayment;
        const monthlyInterestRate = (interestRatePercent / 100) / 12;
        const numberOfPayments = 30 * 12;

        const monthlyMortgagePayment = loanAmount > 0 && monthlyInterestRate > 0 
            ? loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
            : 0;

        const annualPropertyTaxes = propertyTaxesType === 'percent' ? purchasePrice * (annualPropertyTaxesValue / 100) : annualPropertyTaxesValue;
        const monthlyTaxes = annualPropertyTaxes / 12;

        const annualInsurance = insuranceType === 'percent' ? purchasePrice * (annualInsuranceValue / 100) : annualInsuranceValue;
        const monthlyInsurance = annualInsurance / 12;

        const upfrontExpenses = (monthlyMortgagePayment + monthlyTaxes + monthlyInsurance + monthlyMaintenance) * renovationPeriod;

        const totalInitialInvestment = downPayment + renovationCosts + upfrontExpenses;

        const totalMonthlyExpenses = monthlyMortgagePayment + monthlyTaxes + monthlyInsurance + monthlyMaintenance + monthlyManagementFees;

        const monthlyCashFlow = monthlyRentalIncome - totalMonthlyExpenses;
        const annualCashFlow = monthlyCashFlow * 12;

        const cashOnCashROI = (annualCashFlow / totalInitialInvestment) * 100;

        // --- Display Result ---
        const resultElement = document.getElementById('result');
        if (isFinite(cashOnCashROI) && totalInitialInvestment > 0) {
            resultElement.textContent = `Your estimated Cash-on-Cash ROI is: ${cashOnCashROI.toFixed(2)}%`;
        } else {
            resultElement.textContent = 'Please fill in all fields with valid numbers to calculate the ROI.';
        }
        
        // --- Update Summary Table (This function is unchanged) ---
        updateSummaryTable({
            'Purchase Price': purchasePrice,
            'Down Payment': downPayment,
            'Renovation Costs': renovationCosts,
            'Upfront Renovation Period (Months)': renovationPeriod,
            'Mortgage carrying cost (during renovation)': upfrontExpenses,
            'Total Initial Investment': totalInitialInvestment,
            'Loan Amount': loanAmount,
            'Monthly Mortgage (P&I)': monthlyMortgagePayment,
            'Monthly Taxes': monthlyTaxes,
            'Monthly Insurance': monthlyInsurance,
            'Monthly Maintenance': monthlyMaintenance,
            'Monthly Management': monthlyManagementFees,
            'Total Monthly Expenses (Post-Reno)': totalMonthlyExpenses,
            'Monthly Rental Income': monthlyRentalIncome,
            'Monthly Cash Flow (Post-Reno)': monthlyCashFlow,
            'Annual Cash Flow (Post-Reno)': annualCashFlow,
            'Cash-on-Cash ROI (%)': cashOnCashROI
        });
    }

    function updateSummaryTable(data) {
        const tableBody = document.querySelector('#summary-table tbody');
        tableBody.innerHTML = ''; 

        for (const [key, value] of Object.entries(data)) {
            const row = tableBody.insertRow();
            const cell1 = row.insertCell(0);
            const cell2 = row.insertCell(1);

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
            } else if (key.includes('Months')) {
                cell2.textContent = value || 0;
            }
            else {
                 cell2.textContent = formatCurrency(value || 0);
            }
        }
    }

    function formatCurrency(value) {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    }

    // Initial calculation on page load
    calculateAndDisplay();
});