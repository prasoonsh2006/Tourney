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
// const teamNameEl = document.getElementById('team-name'); // ⚠️ Element with this ID is missing in provided HTML
const ownerNameEl = document.getElementById('owner-name');
const remainingBalanceEl = document.getElementById('remaining-balance');
const rechargeBtn = document.getElementById('recharge-btn');
const currentRacerEl = document.getElementById('current-racer-name');
const currentBidEl = document.getElementById('current-bid');
const lastBidderEl = document.getElementById('last-bidder');
const rosterListEl = document.getElementById('roster-list');
const racersWonEl = document.getElementById('racers-won');

// --- STATE VARIABLES ---
let currentUserId = null;
let currentTeamName = "Loading...";
let currentBalance = 0;
let currentMinBid = 0;
let racersWonCount = 0; // 👈 NEW STATE VARIABLE
let countdownInterval;

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
            // Updated placeholders to reflect failure
            // teamNameEl.textContent = "Unregistered Team"; // ⚠️ Element missing in HTML
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
        // teamNameEl.textContent = currentTeamName; // ⚠️ Element missing in HTML
        ownerNameEl.textContent = teamData.ownerName || 'N/A';
        remainingBalanceEl.textContent = `${currentBalance.toLocaleString()} SVC`;

        // 🎯 UPDATE NEW STATE VARIABLE and DOM
        racersWonCount = (teamData.roster && teamData.roster.length) || 0;
        racersWonEl.textContent = `${racersWonCount}/6`; // Assuming a max of 6 racers

        // Update Roster
        const rosterHtml = teamData.roster && teamData.roster.length > 0
            ? teamData.roster.map(racer =>
                // Using the specific class from the CSS to ensure visibility
                `<li class="p-3 rounded text-sm font-medium roster-placeholder">${racer}</li>`
            ).join('')
            : '<li class="p-3 rounded text-center text-sm font-medium roster-placeholder">Roster is empty.</li>';
        rosterListEl.innerHTML = rosterHtml;

        // Disable bidding if roster is full, regardless of auction status
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

        currentRacerEl.textContent = data.racerName || 'Awaiting Setup...';
        currentBidEl.textContent = `${data.currentBid ? data.currentBid.toLocaleString() : 0} SVC`;

        // Ensure currentBid is a number for calculation
        const currentBidValue = data.currentBid || 0;

        // Min bid logic: 500 initial, 500 increase thereafter
        currentMinBid = currentBidValue === 0
            ? 500
            : currentBidValue + 500;

        bidInput.placeholder = `Min Bid: ${currentMinBid.toLocaleString()} SVC`;

        lastBidderEl.textContent = data.lastBidderName
            ? `${data.lastBidderName} (${data.currentBid ? data.currentBid.toLocaleString() : 0} SVC)`
            : 'No Bids Yet';

        // Update UI based on auction status AND roster status
        if (data.status === 'Sold') {
            bidMessageEl.textContent = `${data.lastSoldRacer} was SOLD! Waiting for next auction.`;
            placeBidBtn.disabled = true;
            bidInput.disabled = true;
        } else {
            // Re-enable/disable based on roster status and auction status
            if (racersWonCount >= 6) {
                // Keep disabled if roster is full
                placeBidBtn.disabled = true;
                bidInput.disabled = true;
                bidMessageEl.textContent = "Roster is full (6/6). You cannot bid on new racers.";
            } else {
                bidMessageEl.textContent = '';
                bidInput.disabled = false;
                // Button state will be handled by startServerTimer for 'Live' auctions
            }
        }

        startServerTimer(data.endTime, data.status);
    });
}

// --- CORE BIDDING LOGIC (UPDATED FOR 60s RESET) ---

placeBidBtn.addEventListener('click', async () => {

    // 🎯 INITIAL CHECK: Block bidding if roster is full
    if (racersWonCount >= 6) {
        bidMessageEl.textContent = "Bid failed: You have already won 6 racers. Your roster is full.";
        return;
    }

    const bidAmount = parseInt(bidInput.value);

    // Client-side validation using the correctly calculated currentMinBid
    if (isNaN(bidAmount) || bidAmount < currentMinBid) {
        let message;
        if (currentMinBid === 500 && currentBidEl.textContent.trim() === '0 SVC') {
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

            // ⚠️ CRITICAL CHANGE: Timer ALWAYS resets to 60 seconds (60000ms) on a valid bid
            const newEndTime = Timestamp.fromMillis(Date.now() + 60000);

            t.update(auctionRef, {
                currentBid: bidAmount,
                lastBidderId: currentUserId,
                lastBidderName: currentTeamName, // Use the client-side cached name
                endTime: newEndTime,
                status: 'Live'
            });

            bidMessageEl.textContent = `Bid placed for ${bidAmount.toLocaleString()} SVC! Timer reset to 60s!`;
            bidInput.value = ''; // Clear input after successful bid
        });
    } catch (e) {
        // Targeted error handling
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
        // Keep button disabled if auction is not live OR if the roster is full
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
            // Only enable the button if auction is live AND roster is NOT full
            placeBidBtn.disabled = (racersWonCount >= 6);
        } else {
            clearInterval(countdownInterval);
            auctionTimerEl.textContent = "TIME EXPIRED";
            placeBidBtn.disabled = true;
            // NOTE: Finalizing the auction (selling the racer) must be handled by a
            // server process (like a Firebase Cloud Function) that runs securely.
        }
    }, 1000);
}

// --- RECHARGE LOGIC ---

rechargeBtn.addEventListener('click', async () => {
    let requestedAmount;
    bidMessageEl.textContent = 'Awaiting input for recharge...';

    // Loop until a valid number >= 500 is entered or the user cancels
    while (true) {
        const amountInput = prompt(`Enter the SVC amount you are requesting (must be 500 SVC or more):`);

        if (amountInput === null) { // User pressed Cancel
            bidMessageEl.textContent = 'Recharge request cancelled.';
            return;
        }

        requestedAmount = parseInt(amountInput);

        if (isNaN(requestedAmount) || requestedAmount < 500) {
            alert("Invalid amount. Please enter a number that is 500 SVC or greater.");
        } else {
            break; // Valid amount entered, exit loop
        }
    }

    const paymentProof = prompt(`Enter payment transaction ID/Note for ${requestedAmount.toLocaleString()} SVC (e.g., Bank Transfer Ref, Cash Note):`);

    if (!paymentProof) {
        bidMessageEl.textContent = 'Recharge request cancelled.';
        return; // User cancelled the second prompt
    }

    try {
        await addDoc(collection(db, 'rechargeRequests'), {
            userId: currentUserId,
            teamName: currentTeamName,
            svcAmount: requestedAmount, // Saving as a number
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