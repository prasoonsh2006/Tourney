document.addEventListener('DOMContentLoaded', () => {

    const SHEET_ID = '2PACX-1vRdch7spgkSn-EFbUnurxRM5VT5L5Robdn8QmkNbOHhwmIrXqceUgpAwzlhOIgkrTLN3y0qsxG-EvE4';

// Paste the FULL URL for each of your published sheets below
    const GIDS = {
        'upper-bracket': 'https://docs.google.com/spreadsheets/d/1z2JVBt42A52et25Vj-oMmVeaXfQmobSFSI3fy_Hmk1Q/edit?gid=1661894301#gid=1661894301',
        'lower-bracket': 'https://docs.google.com/spreadsheets/d/1z2JVBt42A52et25Vj-oMmVeaXfQmobSFSI3fy_Hmk1Q/edit?gid=1820826798#gid=1820826798'
    };

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

// The rest of the code is correct.
// ... (all the other functions and event listeners) ...

    // Function to find the next power of 2 for dynamic brackets
    function nextPowerOfTwo(n) {
        if (n <= 1) return 1;
        let powerOfTwo = 2;
        while (powerOfTwo < n) {
            powerOfTwo *= 2;
        }
        return powerOfTwo;
    }

    // Function to create a single match element
    function createMatch(teamA, teamB) {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'match';

        let content = '';
        if (teamB === 'BYE') {
            content = `
                <div class="match-top team winner-top">
                    <span class="image"></span>
                    <span class="name">${teamA.name}</span>
                </div>
                <div class="match-bottom team">
                    <span class="image"></span>
                    <span class="name">BYE</span>
                </div>
            `;
        } else {
            content = `
                <div class="match-top team">
                    <span class="image"></span>
                    <span class="name">${teamA.name}</span>
                </div>
                <div class="match-bottom team">
                    <span class="image"></span>
                    <span class="name">${teamB.name}</span>
                </div>
            `;
        }

        matchDiv.innerHTML = content;
        return matchDiv;
    }

    // Function to build the bracket dynamically
    function buildBracket(teams, container) {
        container.innerHTML = ''; // Clear existing content

        if (teams.length === 0) {
            container.innerHTML = `<div style="color:white; text-align:center;">No teams found for this bracket.</div>`;
            return;
        }

        const numTeams = teams.length;
        const bracketSize = nextPowerOfTwo(numTeams);
        const numByes = bracketSize - numTeams;

        let roundTeams = [];

        // Round 1: Pair up teams and handle byes
        const byeTeams = teams.slice(0, numByes);
        const firstRoundTeams = teams.slice(numByes);

        // Pair the remaining teams
        const numFirstRoundMatches = firstRoundTeams.length / 2;
        let matchIndex = 0;
        for (let i = 0; i < numFirstRoundMatches; i++) {
            roundTeams.push({
                teamA: firstRoundTeams[matchIndex],
                teamB: firstRoundTeams[matchIndex + 1]
            });
            matchIndex += 2;
        }

        // Add bye teams to the next round directly
        byeTeams.forEach((team) => {
            roundTeams.push({
                teamA: team,
                teamB: 'BYE'
            });
        });

        roundTeams.sort((a, b) => (a.teamB === 'BYE') - (b.teamB === 'BYE'));

        let currentRound = 1;
        let currentRoundMatches = roundTeams;

        const bracketDiv = document.createElement('div');
        bracketDiv.className = 'bracket disable-image';

        while (currentRoundMatches.length > 0) {
            const column = document.createElement('div');
            column.className = `column round-${currentRound}`;

            currentRoundMatches.forEach(match => {
                const matchEl = createMatch(match.teamA, match.teamB);
                column.appendChild(matchEl);
            });

            bracketDiv.appendChild(column);

            let nextRoundTeams = [];
            for (let i = 0; i < currentRoundMatches.length; i += 2) {
                if (currentRoundMatches[i] && currentRoundMatches[i + 1]) {
                    const winnerName = (currentRoundMatches[i].teamB === 'BYE') ?
                        currentRoundMatches[i].teamA.name :
                        `Winner R${currentRound} M${(i/2)+1}`;

                    nextRoundTeams.push({
                        name: winnerName
                    });
                } else if (currentRoundMatches[i]) {
                    nextRoundTeams.push(currentRoundMatches[i].teamA);
                }
            }
            currentRoundMatches = nextRoundTeams;
            currentRound++;
        }

        container.appendChild(bracketDiv);
    }

    // Main async function to load data and build the bracket for a given tab
    async function loadBracket(tabId) {
        const container = document.getElementById(tabId + '-bracket');
        container.innerHTML = `<div class="loading">Loading...</div>`;

        const gid = GIDS[tabId];
        if (!gid) {
            container.innerHTML = `<div style="color:white; text-align:center;">No GID found for this tab.</div>`;
            return;
        }

        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const raw = await res.text();

            Papa.parse(raw, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    const teams = results.data.filter(t => t.TeamName && t.TeamName.trim() !== '').map(t => ({ name: t.TeamName }));
                    buildBracket(teams, container);
                }
            });

        } catch (err) {
            console.error('Error fetching data:', err);
            container.innerHTML = `<div style="color:white; text-align:center;">Failed to load teams.</div>`;
        }
    }

    // Event listener for tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.add('hidden'));

            button.classList.add('active');

            const targetId = button.dataset.tab;
            const targetPane = document.getElementById(targetId + '-bracket');
            if (targetPane) {
                targetPane.classList.remove('hidden');
                loadBracket(targetId);
            }
        });
    });

    // Load the default tab on page load
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
        loadBracket(activeTab.dataset.tab);
    }
});