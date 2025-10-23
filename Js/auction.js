import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, runTransaction, Timestamp, addDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- CONFIGURATION ---

// 🚨 REPLACE WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCFA20hwEGRGXeiX0LrPKhc-VL5K4umGv0", // Your actual key
    authDomain: "souls-of-soulcity.firebaseapp.com",
    projectId: "souls-of-soulcity",
    storageBucket: "souls-of-soulcity.firebasestorage.app",
    messagingSenderId: "402427120355",
    appId: "1:402427120355:web:f0fa030a0a9034198213d6"
};

// 🚨 REPLACE WITH YOUR ADMIN USER'S UID
const AUTHORIZED_ADMIN_UIDS = ["8boxpeVzXUg299rHWXdZseORad92"];

// --- INITIALIZATION ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const logoutBtn = document.getElementById('logout-btn');
const placeBidBtn = document.getElementById('place-bid-btn');
const bidInput = document.getElementById('bid-input');
const bidMessageEl = document.getElementById('bid-message');
const auctionTimerEl = document.getElementById('auction-timer');
const ownerNameEl = document.getElementById('owner-name');
const remainingBalanceEl = document.getElementById('remaining-balance');
const rechargeBtn = document.getElementById('recharge-btn');
const currentRacerEl = document.getElementById('current-racer-name');
const odometerContainerEl = document.getElementById('odometer-container');
const lastBidderEl = document.getElementById('last-bidder');
const rosterListEl = document.getElementById('roster-list');
const racersWonEl = document.getElementById('racers-won');

// --- STATE VARIABLES ---
let currentUserId = null;
let currentTeamName = "Loading...";
let currentBalance = 0;
let currentMinBid = 0;
let racersWonCount = 0;
let countdownInterval;
// 🎯 State variable to track the bid for the odometer effect
let previousBidValue = 0;


// --- ODOMETER ANIMATION HANDLER (Digit-by-Digit) ---
function animateBidUpdate(newBidValue) {
    // 1. Format the number string, ensuring a comma separator if needed (e.g., 5000 -> "5,000")
    const newBidString = newBidValue.toLocaleString();

    // 2. Check if the structure needs a complete rebuild (e.g., 999 to 1,000)
    const currentStructure = odometerContainerEl.children;
    let needsRebuild = currentStructure.length !== newBidString.length;

    // If lengths are the same, check if content type (digit vs comma) has changed
    if (!needsRebuild) {
        for (let i = 0; i < newBidString.length; i++) {
            const char = newBidString[i];
            const child = currentStructure[i];

            const childIsDigit = child && child.classList.contains('digit-wrapper');
            const charIsDigit = char !== ',';

            if (childIsDigit !== charIsDigit) {
                needsRebuild = true;
                break;
            }
        }
    }

    let digitElements = [];

    if (needsRebuild) {
        odometerContainerEl.innerHTML = ''; // Clear existing digits

        for (let i = 0; i < newBidString.length; i++) {
            const char = newBidString[i];

            if (char === ',') {
                const sep = document.createElement('div');
                sep.className = 'separator-wrapper';
                sep.textContent = ',';
                odometerContainerEl.appendChild(sep);
            } else {
                const digitWrapper = document.createElement('div');
                digitWrapper.className = 'digit-wrapper';

                const digitRoll = document.createElement('div');
                digitRoll.className = 'digit-roll';
                // Stack all digits 0-9 vertically
                digitRoll.innerHTML = '0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9';

                digitWrapper.appendChild(digitRoll);
                odometerContainerEl.appendChild(digitWrapper);

                digitElements.push(digitRoll);

                // Initialize roll position to the current digit value
                const digitValue = parseInt(char);
                // Each number occupies 1.2em height
                digitRoll.style.transform = `translateY(-${digitValue * 1.2}em)`;
            }
        }
    } else {
        // Get existing digit rollers if no rebuild needed
        digitElements = Array.from(odometerContainerEl.querySelectorAll('.digit-roll'));
    }

    // 4. Roll the digits for the new value
    let digitIndex = 0;

    // Only animate if the new value is higher
    if (newBidValue > previousBidValue) {
        for (let i = 0; i < newBidString.length; i++) {
            const char = newBidString[i];

            if (char !== ',') {
                const digitRollEl = digitElements[digitIndex];
                const newDigit = parseInt(char);

                if (digitRollEl) {
                    // Calculate the vertical offset (1.2em per digit)
                    const translateYValue = -newDigit * 1.2;

                    // Apply the transformation which triggers the CSS transition
                    digitRollEl.style.transform = `translateY(${translateYValue}em)`;
                }
                digitIndex++;
            }
        }
    }

    // 5. Update the tracking variable
    previousBidValue = newBidValue;
}


// --- AUTHENTICATION, SECURITY, AND REDIRECTION ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        const isAuthorizedAdmin = AUTHORIZED_ADMIN_UIDS.includes(user.uid);

        if (isAuthorizedAdmin) {
            window.location.href = 'admin.html';
            return;
        }

        setupTeamListener(user.uid);
        setupAuctionFeed();

    } else {
        window.location.href = 'login.html';
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
});

// --- LIVE DATA LISTENERS ---

function setupTeamListener(userId) {
    onSnapshot(doc(db, "teams", userId), docSnapshot => {
        if (!docSnapshot.exists()) {
            remainingBalanceEl.textContent = "0 SVC";
            ownerNameEl.textContent = "N/A";
            rosterListEl.innerHTML = '<li class="p-3 rounded text-center text-sm font-medium roster-placeholder">No roster data found.</li>';
            racersWonEl.textContent = "0/6";
            console.error("Team document not found for UID:", userId);
            return;
        }

        const teamData = docSnapshot.data();
        currentBalance = teamData.balance || 0;
        currentTeamName = teamData.teamName || 'N/A';

        // Update Team Dashboard elements
        ownerNameEl.textContent = teamData.ownerName || 'N/A';
        remainingBalanceEl.textContent = `${currentBalance.toLocaleString()} SVC`;

        racersWonCount = (teamData.roster && teamData.roster.length) || 0;
        racersWonEl.textContent = `${racersWonCount}/6`;

        // Update Roster
        const rosterHtml = teamData.roster && teamData.roster.length > 0
            ? teamData.roster.map(racer =>
                `<li class="p-3 rounded text-sm font-medium roster-placeholder">${racer}</li>`
            ).join('')
            : '<li class="p-3 rounded text-center text-sm font-medium roster-placeholder">Roster is empty.</li>';
        rosterListEl.innerHTML = rosterHtml;

        // Disable bidding if roster is full
        if (racersWonCount >= 6) {
            placeBidBtn.disabled = true;
            bidInput.disabled = true;
            bidMessageEl.textContent = "Roster is full (6/6). You cannot bid on new racers.";
        }
    });
}

function setupAuctionFeed() {
    onSnapshot(doc(db, "auctions", "currentRacer"), docSnapshot => {
        if (!docSnapshot.exists()) return;

        const data = docSnapshot.data();
        const currentBidValue = data.currentBid || 0;

        currentRacerEl.textContent = data.racerName || 'Awaiting Setup...';

        // 🎯 USE THE ANIMATION FUNCTION
        animateBidUpdate(currentBidValue);

        // Min bid logic: 500 initial, 500 increase thereafter
        currentMinBid = currentBidValue === 0
            ? 500
            : currentBidValue + 500;

        bidInput.placeholder = `Min Bid: ${currentMinBid.toLocaleString()} SVC`;

        // Last bidder display
        lastBidderEl.textContent = data.lastBidderName
            ? `${data.lastBidderName} (${currentBidValue.toLocaleString()} SVC)`
            : 'No Bids Yet';

        // Update UI based on auction status AND roster status
        if (data.status === 'Sold') {
            bidMessageEl.textContent = `${data.lastSoldRacer} was SOLD! Waiting for next auction.`;
            placeBidBtn.disabled = true;
            bidInput.disabled = true;
        } else {
            // Re-enable/disable based on roster status and auction status
            if (racersWonCount >= 6) {
                placeBidBtn.disabled = true;
                bidInput.disabled = true;
                bidMessageEl.textContent = "Roster is full (6/6). You cannot bid on new racers.";
            } else {
                bidMessageEl.textContent = '';
                bidInput.disabled = false;
            }
        }

        startServerTimer(data.endTime, data.status);
    });
}

// --- CORE BIDDING LOGIC ---

placeBidBtn.addEventListener('click', async () => {

    if (racersWonCount >= 6) {
        bidMessageEl.textContent = "Bid failed: You have already won 6 racers. Your roster is full.";
        return;
    }

    const bidAmount = parseInt(bidInput.value);

    // Client-side validation
    if (isNaN(bidAmount) || bidAmount < currentMinBid) {
        let message;
        if (currentMinBid === 500 && previousBidValue === 0) {
            message = `Bid failed: The starting bid must be at least 500 SVC.`;
        } else {
            message = `Bid failed: Your bid must be at least ${currentMinBid.toLocaleString()} SVC (a minimum increase of 500 SVC).`;
        }
        bidMessageEl.textContent = message;
        return;
    }

    if (bidAmount > currentBalance) {
        bidMessageEl.textContent = "Bid failed: Insufficient balance.";
        return;
    }

    const auctionRef = doc(db, "auctions", "currentRacer");
    const teamRef = doc(db, "teams", currentUserId);

    try {
        await runTransaction(db, async (t) => {
            const auctionDoc = await t.get(auctionRef);
            const teamDoc = await t.get(teamRef);

            const auctionData = auctionDoc.data();
            const teamData = teamDoc.data();

            // Server-side roster check
            const dbRacersWonCount = (teamData.roster && teamData.roster.length) || 0;
            if (dbRacersWonCount >= 6) {
                throw new Error("RosterFull");
            }

            // Server-side bid validation
            const dbCurrentBid = auctionData.currentBid || 0;
            const dbMinBid = dbCurrentBid === 0 ? 500 : dbCurrentBid + 500;

            if (bidAmount < dbMinBid || bidAmount > teamData.balance) {
                throw new Error("BidConditionFailed");
            }

            // Timer ALWAYS resets to 60 seconds (60000ms) on a valid bid
            const newEndTime = Timestamp.fromMillis(Date.now() + 60000);

            t.update(auctionRef, {
                currentBid: bidAmount,
                lastBidderId: currentUserId,
                lastBidderName: currentTeamName,
                endTime: newEndTime,
                status: 'Live'
            });

            bidMessageEl.textContent = `Bid placed for ${bidAmount.toLocaleString()} SVC! Timer reset to 60s!`;
            bidInput.value = ''; // Clear input after successful bid
        });
    } catch (e) {
        if (e.message.includes("RosterFull")) {
            bidMessageEl.textContent = "Bid failed: Your roster is full (6/6). You cannot bid on new racers.";
        } else if (e.message.includes("BidConditionFailed")) {
            bidMessageEl.textContent = "Bid failed: Your bid was too low (must be 500 SVC higher than current bid) or your balance changed during the bid attempt. Please check the current minimum bid.";
        } else {
            bidMessageEl.textContent = `Bid failed: ${e.message}`;
        }
    }
});

// --- TIMER LOGIC ---

function startServerTimer(timerEndsAt, status) {
    if (status !== 'Live' || !timerEndsAt || racersWonCount >= 6) {
        auctionTimerEl.textContent = "Auction Pending";
        placeBidBtn.disabled = true;
        return;
    }

    clearInterval(countdownInterval);
    const endTime = timerEndsAt.toDate().getTime();

    countdownInterval = setInterval(() => {
        const distance = endTime - Date.now();
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (distance > 0) {
            auctionTimerEl.textContent = `${seconds.toString().padStart(2, '0')}s`;
            placeBidBtn.disabled = (racersWonCount >= 6);
        } else {
            clearInterval(countdownInterval);
            auctionTimerEl.textContent = "TIME EXPIRED";
            placeBidBtn.disabled = true;
            // Server process must handle the final sale.
        }
    }, 1000);
}

// --- RECHARGE LOGIC ---

rechargeBtn.addEventListener('click', async () => {
    let requestedAmount;
    bidMessageEl.textContent = 'Awaiting input for recharge...';

    while (true) {
        const amountInput = prompt(`Enter the SVC amount you are requesting (must be 500 SVC or more):`);

        if (amountInput === null) {
            bidMessageEl.textContent = 'Recharge request cancelled.';
            return;
        }

        requestedAmount = parseInt(amountInput);

        if (isNaN(requestedAmount) || requestedAmount < 500) {
            alert("Invalid amount. Please enter a number that is 500 SVC or greater.");
        } else {
            break;
        }
    }

    const paymentProof = prompt(`Enter payment transaction ID/Note for ${requestedAmount.toLocaleString()} SVC (e.g., Bank Transfer Ref, Cash Note):`);

    if (!paymentProof) {
        bidMessageEl.textContent = 'Recharge request cancelled.';
        return;
    }

    try {
        await addDoc(collection(db, 'rechargeRequests'), {
            userId: currentUserId,
            teamName: currentTeamName,
            svcAmount: requestedAmount,
            paymentNote: paymentProof,
            status: 'Pending',
            timestamp: Timestamp.now()
        });
        bidMessageEl.textContent = `✅ Request for ${requestedAmount.toLocaleString()} SVC submitted. Awaiting Admin approval.`;
    } catch (e) {
        console.error("Error submitting recharge request:", e);
        bidMessageEl.textContent = "❌ Failed to submit request.";
    }
});