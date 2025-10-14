// auction.js

// DOM Elements
const teamNameEl = document.getElementById('team-name');
const ownerNameEl = document.getElementById('owner-name');
const balanceEl = document.getElementById('remaining-balance');
const racersWonEl = document.getElementById('racers-won');
const logoutBtn = document.getElementById('logout-btn');

const racerNameEl = document.getElementById('racer-name');
const currentBidEl = document.getElementById('current-bid');
const lastBidderEl = document.getElementById('last-bidder');
const auctionTimerEl = document.getElementById('auction-timer');
const bidInput = document.getElementById('bid-input');
const placeBidBtn = document.getElementById('place-bid-btn');
const bidMessageEl = document.getElementById('bid-message');
const rosterListEl = document.getElementById('roster-list');

// Recharge Modal Elements
const rechargeBtn = document.getElementById('recharge-btn');
const rechargeModal = document.getElementById('recharge-modal');
const closeModalBtn = rechargeModal.querySelector('.close-btn');
const svcInput = document.getElementById('svc-input');
const usdEstimateEl = document.getElementById('usd-estimate');
const paymentNoteInput = document.getElementById('payment-note');
const submitRechargeBtn = document.getElementById('submit-recharge-btn');

let currentUserId = null;
let currentBalance = 0;
let currentMinBid = 0;
let countdownInterval;

// --- INITIALIZATION ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        setupTeamListener(user.uid);
        setupAuctionFeed();
        setupRosterListener(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
});

// --- TEAM DATA LISTENER ---
function setupTeamListener(uid) {
    db.collection("teams").doc(uid).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            teamNameEl.textContent = data.teamName;
            ownerNameEl.textContent = data.ownerName;
            currentBalance = data.balance;
            balanceEl.textContent = `${currentBalance.toLocaleString()} SVC`;
            racersWonEl.textContent = `${data.racersWon || 0}/6`;

            // SECURITY CHECK: If user is admin, redirect them
            if (data.isAdmin === true) {
                window.location.href = 'admin.html';
            }
        }
    });
}

// --- LIVE AUCTION FEED LISTENER ---
function setupAuctionFeed() {
    db.collection("auctions").doc("currentRacer").onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            racerNameEl.textContent = data.name;
            currentMinBid = data.currentBid + 1;
            currentBidEl.textContent = `${data.currentBid.toLocaleString()} SVC`;
            lastBidderEl.textContent = data.lastBidderName || "N/A (Base Price)";
            bidInput.placeholder = `Minimum bid: ${currentMinBid.toLocaleString()} SVC`;

            startServerTimer(data.timerEndsAt);
        } else {
            racerNameEl.textContent = "Auction Ended / Awaiting Setup";
            currentBidEl.textContent = 'N/A';
        }
    });
}

// --- BIDDING LOGIC ---
placeBidBtn.addEventListener('click', async () => {
    const bidAmount = parseInt(bidInput.value);
    bidMessageEl.textContent = '';

    if (!bidAmount || bidAmount < currentMinBid) {
        bidMessageEl.textContent = `Bid must be at least ${currentMinBid.toLocaleString()} SVC.`;
        return;
    }
    if (bidAmount > currentBalance) {
        bidMessageEl.textContent = `Insufficient balance. You only have ${currentBalance.toLocaleString()} SVC.`;
        return;
    }

    // Securely update the bid using a transaction
    const auctionRef = db.collection("auctions").doc("currentRacer");
    const teamRef = db.collection("teams").doc(currentUserId);

    try {
        await db.runTransaction(async (t) => {
            const auctionDoc = await t.get(auctionRef);
            const teamDoc = await t.get(teamRef);

            const currentData = auctionDoc.data();
            const teamData = teamDoc.data();

            // Re-check security and min bid inside the transaction
            if (bidAmount < currentData.currentBid + 1) {
                throw new Error("Bid is too low or already surpassed.");
            }
            if (bidAmount > teamData.balance) {
                throw new Error("Insufficient funds for this bid.");
            }

            // Update the auction state
            t.update(auctionRef, {
                currentBid: bidAmount,
                lastBidderId: currentUserId,
                lastBidderName: teamData.teamName,
                timerEndsAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 10000) // 10 second reset
            });

            bidMessageEl.textContent = `Bid placed for ${bidAmount.toLocaleString()} SVC!`;
            bidInput.value = '';

        });
    } catch (e) {
        console.error("Bid transaction failed: ", e.message);
        bidMessageEl.textContent = `Bid failed: ${e.message}`;
    }
});

// --- ROSTER LISTENER ---
function setupRosterListener(uid) {
    db.collection("teams").doc(uid).collection("soldRacers").onSnapshot(snapshot => {
        rosterListEl.innerHTML = '';
        snapshot.forEach(doc => {
            const racer = doc.data();
            const li = document.createElement('li');
            li.textContent = `Name: ${racer.racerName} (Won for ${racer.winningBid.toLocaleString()} SVC)`;
            rosterListEl.appendChild(li);
        });
    });
}


// --- SVC RECHARGE LOGIC ---

// Modal Open/Close Handlers
closeModalBtn.addEventListener('click', () => { rechargeModal.style.display = 'none'; });
rechargeBtn.addEventListener('click', () => {
    rechargeModal.style.display = 'block';
    svcInput.value = '';
    usdEstimateEl.textContent = '$0.00 USD';
});
window.addEventListener('click', (event) => {
    if (event.target == rechargeModal) { rechargeModal.style.display = 'none'; }
});


// SVC to USD Calculation
svcInput.addEventListener('input', () => {
    const svcAmount = parseFloat(svcInput.value) || 0;
    // CALCULATION: USD Cost = SVC Amount * 200 (1 SVC = $200 USD)
    const dollars = svcAmount * 200;
    usdEstimateEl.textContent = `$${dollars.toFixed(2)} USD`;
});


// Submission Handler
submitRechargeBtn.addEventListener('click', async () => {
    const svcAmount = parseFloat(svcInput.value);
    const dollars = svcAmount * 200;
    const paymentNote = paymentNoteInput.value.trim();

    if (svcAmount < 1 || !paymentNote) {
        alert("The minimum purchase is 1 SVC ($200 USD). Please enter an amount and provide payment proof.");
        return;
    }

    const teamName = teamNameEl.textContent;
    const ownerName = ownerNameEl.textContent;

    try {
        await db.collection('rechargeRequests').add({
            teamId: currentUserId,
            teamName: teamName,
            ownerName: ownerName,
            dollarAmount: dollars,
            svcAmount: svcAmount,
            paymentDetails: paymentNote,
            status: 'Pending',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Recharge request for ${svcAmount.toFixed(2)} SVC ($${dollars.toFixed(2)} USD) submitted! Please wait for admin approval.`);
        rechargeModal.style.display = 'none';

    } catch (error) {
        console.error("Error submitting recharge request:", error);
        alert("Failed to submit request. Please check your console.");
    }
});


// --- TIMER LOGIC (Reuse) ---
function startServerTimer(timerEndsAt) {
    if (!timerEndsAt) {
        auctionTimerEl.textContent = "Auction Pending";
        return;
    }
    clearInterval(countdownInterval);
    const endTime = timerEndsAt.toDate().getTime();

    countdownInterval = setInterval(() => {
        const now = Date.now();
        const distance = endTime - now;

        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (distance > 0) {
            auctionTimerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            clearInterval(countdownInterval);
            auctionTimerEl.textContent = "SOLD!";
        }
    }, 1000);
}