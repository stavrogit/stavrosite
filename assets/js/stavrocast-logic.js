document.addEventListener('DOMContentLoaded', function() {
                    // Airport data object (State Abbreviation: [Airport Codes])
                    const airportData = {
                        "AK": ["PAKP", "PAFM", "PFYU", "PAWD", "PANC", "PANT", "PABR", "PABE", "PACD", "PASY", "PAFA", "PAKN", "PADQ", "PAOT", "PAMC", "PAOM", "PASN", "PAYA", "PABT", "PALU", "PAEH", "PACZ", "PACV", "PASC", "PABI", "PADL", "PAGA", "PAGK", "PAHN", "PAHO", "PAIL", "PAIM", "PAOR", "PAPG", "PASI", "PATK", "PATA", "PATC", "PAUN", "PADU", "PAJN"],
                        "AL": ["KEET", "KMOB", "KHSV", "KOZR", "KMGM"],
                        "AR": ["KLIT", "KFSM", "KELD", "KJBR", "KTXK", "KFYV"],
                        "AZ": ["KPHX", "KTUS", "KFLG", "KPGA", "KYUM", "KGCN", "KINW", "KDUG", "KSAD", "KSOW", "KPRC"],
                        "CA": ["KLAX", "KSFO", "KFAT", "KMRY", "KSAC", "KSAN", "KEDW", "KPSP", "KRDD", "KVBG", "KNID", "KACV", "KBFL", "KBYS", "KBIH", "KBLH", "KNJK", "KMOD", "KEED", "KPRB", "KSTS", "KONT", "KBLU"],
                        "CO": ["KDEN", "KGJT", "KPUB", "KAKO", "KASE", "KCAG", "KDRO", "KGXY", "KLAA", "KLIC", "KALS", "KCOS"],
                        "CT": ["KHFD", "KBDR"],
                        "FL": ["KJAX", "KMIA", "KEYW", "KMCO", "KTLH", "KTPA", "KGNV", "KMLB", "KVRB", "KVPS", "KRSW", "KPAM", "KDAB", "KPBI"],
                        "GA": ["KATL", "KMCN", "KAHN", "KAGS", "KSAV", "KABY", "KAMG", "KCSG", "KVLD"],
                        "HI": ["PHTO", "PHLI", "PHMO", "PHKO", "PHNL"],
                        "IA": ["KDSM", "KOMA", "KDVN", "KSUX", "KCID", "KDBQ", "KALO", "KBRL", "KFOD", "KOTM", "KSPW"],
                        "ID": ["KBOI", "KPIH", "KCOE", "KBYI", "KSUN", "KLWS", "KMYL", "KSMN"],
                        "IL": ["KORD", "KDEC", "KPIA", "KRFD", "KAAA", "KBLV"],
                        "IN": ["KIND", "KFWA", "KEVV", "KGYY", "KLAF", "KSBN"],
                        "KS": ["KDDC", "KGLD", "KICT", "KGCK", "KHYS", "KLBL", "KMHK", "KCNU", "KTOP"],
                        "KY": ["KLOU", "KPAH", "KBWG", "KLEX", "KJKL", "KCVG"],
                        "LA": ["KMSY", "KLCH", "KSHV", "KBTR", "KPOE", "KMLU", "KASD"],
                        "MA": ["KBOS", "KACK", "KORE"],
                        "MD": ["KSBY", "KBWI", "KNHK"],
                        "ME": ["KCAR", "KBGR", "KPWM", "KAUG", "KEPM", "KHUL"],
                        "MI": ["KANJ", "KDTW", "KGLR", "KGRR", "KAPN", "KFNT", "KLAN", "KMKG", "KMQT"],
                        "MN": ["KMSP", "KINL", "KDLH", "KAXN", "KBRD", "KPKD", "KRWF", "KRST", "KRRT", "KHIB", "KSTC"],
                        "MO": ["KMCI", "KSTL", "KCOU", "KSTJ", "KSGF", "KIRK", "KPOF", "KSZL"],
                        "MS": ["KJAN", "KGWO", "KTUP", "KNMM", "KPIB"],
                        "MT": ["KGTF", "KGGW", "KWEY", "KHVR", "KMSO", "KBZN", "KCTB", "KHLN", "KMLS", "KBIL", "KDLN", "KGDV", "KGPI", "KLWT"],
                        "NC": ["KILM", "KHSE", "KRDU", "KNKT", "KGSO", "KAVL", "KCLT", "KFAY", "KTNB"],
                        "ND": ["KBIS", "KFAR", "KGFK", "KDIK", "KJMS", "KMIB", "KISN"],
                        "NE": ["KVTN", "KLBF", "KCDR", "KGRI", "KMCK", "KONL", "KBFF", "KLNK"],
                        "NH": ["KCON"],
                        "NJ": ["KACY"],
                        "NM": ["KABQ", "KCVS", "KHMN", "KROW", "KGUP", "KCNM", "KDMN", "KHOB", "KTCS", "K2C2", "KSAF", "KLVS"],
                        "NV": ["KTPH", "KLAS", "KRNO", "KEKO", "KELY", "KWMC", "KLOL"],
                        "NY": ["KBUF", "KLGA", "KALB", "KSYR", "KPOU", "KUCA", "KGTB", "KMSS", "KISP", "KBGM"],
                        "OH": ["KCLE", "KILN", "KCMH", "KDAY", "KFDY"],
                        "OK": ["KOKC", "KTUL", "KADM", "KEND", "KGAG", "KHBR", "KMLC"],
                        "OR": ["KMFR", "KEUG", "KPDX", "KPDT", "KAST", "KBKE", "KBNO", "KLKV", "KOTH", "KRDM", "KREO", "KSLE"],
                        "PA": ["KPIT", "KPHL", "KUNV", "KERI", "KAVP", "KBFD", "KJST", "KMDT"],
                        "PR": ["TJSJ"],
                        "RI": ["KPVD"],
                        "SC": ["KCHS", "KCAE", "KGSP", "KFLO"],
                        "SD": ["KRAP", "KFSD", "KABR", "KPIR", "KHON", "KMBG", "KATY", "K2WX"],
                        "TN": ["KMEM", "KBNA", "KTRI", "KCHA", "KTYS", "KCSV", "KDYR"],
                        "TX": ["KDFW", "KBRO", "KLBB", "KCRP", "KDRT", "KELP", "KIAH", "KAMA", "KAUS", "KCDS", "KLRD", "KABI", "KCLL", "KGGG", "KTYR", "KSPS", "KMAF", "KSJT", "KDHT", "KFST", "KJCT", "KLFK", "KMRF", "KPSX", "KACT", "KMWL", "KSAT"],
                        "UT": ["KSLC", "KCDC", "KENV", "KLGU", "KVEL", "KDPG"],
                        "VA": ["KIAD", "KROA", "KORF", "KRIC", "KCHO"],
                        "VT": ["KBTV", "KMPV"],
                        "WA": ["KSEA", "KGEG", "KUIL", "KDLS", "KYKM", "KHQM", "KBLI", "KEPH", "KSMP"],
                        "WI": ["KGRB", "KMKE", "KEAU", "KMSN", "KHYR", "KLSE", "KCWA"],
                        "WV": ["KHTS", "KEKN", "KMRB", "KBKW", "KPKB", "KMGW", "KCBE", "KCRW"],
                        "WY": ["KSHR", "KRIW", "KCYS", "KCOD", "KBPI", "KCPR", "KGCC", "KJAC", "KRWL", "KRKS", "KWRL"]
                    };

                    const stateInput = document.getElementById('stateInput');
                    const airportSelect = document.getElementById('airportSelect');
                    const getForecastButton = document.getElementById('getForecastButton');
                    const forecastImage = document.getElementById('forecastImage');
                    const imagePlaceholderText = document.getElementById('imagePlaceholderText');

                    // --- Airport Selection Logic (Placeholder for future ESRI App integration) ---
                    // The following state input and airport dropdown functionality is a temporary
                    // method for selecting an airport. This section will likely be replaced or
                    // heavily modified when integrating an ESRI Instant App for airport selection.
                    // ---

                    function populateAirportDropdown(stateAbbrev) {
                        airportSelect.innerHTML = ''; // Clear existing options

                        const airports = airportData[stateAbbrev.toUpperCase()];
                        if (airports) {
                            airportSelect.disabled = false;
                            const defaultOption = document.createElement('option');
                            defaultOption.value = "";
                            defaultOption.textContent = "-- Select Airport --";
                            airportSelect.appendChild(defaultOption);

                            airports.forEach(function(airportCode) {
                                const option = document.createElement('option');
                                option.value = airportCode;
                                option.textContent = airportCode;
                                airportSelect.appendChild(option);
                            });
                        } else {
                            const option = document.createElement('option');
                            option.value = "";
                            option.textContent = "-- Invalid State --";
                            airportSelect.appendChild(option);
                            airportSelect.disabled = true;
                        }
                    }

                    stateInput.addEventListener('input', function() {
                        const stateValue = this.value.trim().toUpperCase();
                        if (stateValue.length === 2) {
                            populateAirportDropdown(stateValue);
                        } else {
                            airportSelect.innerHTML = '<option value="">-- Enter 2-Letter State --</option>';
                            airportSelect.disabled = true;
                        }
                        // Clear previous forecast image when state input changes
                        forecastImage.style.display = 'none';
                        forecastImage.src = '';
                        imagePlaceholderText.style.display = 'block';
                        imagePlaceholderText.textContent = 'Forecast will appear here once an airport is selected and "Get Forecast" is clicked.';
                    });

                    function displayForecast() {
                        const selectedAirport = airportSelect.value;
                        if (selectedAirport) {
                            imagePlaceholderText.textContent = 'Loading forecast for ' + selectedAirport + '...';
                            imagePlaceholderText.style.display = 'block';
                            forecastImage.style.display = 'none';
                            forecastImage.src = ''; 

                            const forecastUrl = `http://StaviMondavi.pythonanywhere.com/plot/${selectedAirport}`;
                            
                            const tempImg = new Image();
                            tempImg.onload = function() {
                                forecastImage.src = forecastUrl;
                                forecastImage.style.display = 'block'; 
                                imagePlaceholderText.style.display = 'none'; 
                            };
                            tempImg.onerror = function() {
                                imagePlaceholderText.textContent = 'Forecast data currently unavailable for ' + selectedAirport + '. Please try another airport or check back later.';
                                imagePlaceholderText.style.display = 'block';
                                forecastImage.style.display = 'none';
                            };
                            tempImg.src = forecastUrl;

                        } else {
                            imagePlaceholderText.textContent = 'Please select an airport.';
                            imagePlaceholderText.style.display = 'block';
                            forecastImage.style.display = 'none';
                            forecastImage.src = '';
                        }
                    }

                    getForecastButton.addEventListener('click', displayForecast);

                });