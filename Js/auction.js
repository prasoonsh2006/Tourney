import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    getFirestore, doc, onSnapshot, collection, runTransaction,
    Timestamp, addDoc, getDoc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCFA20hwEGRGXeiX0LrPKhc-VL5K4umGv0",
    authDomain: "souls-of-soulcity.firebaseapp.com",
    projectId: "souls-of-soulcity",
    storageBucket: "souls-of-soulcity.firebaseapp.com",
    messagingSenderId: "402427120355",
    appId: "1:402427120355:web:f0fa030a0a9034198213d6"
};

const AUTHORIZED_ADMIN_UIDS = ["8boxpeVzXUg299rHWXdZseORad92"];
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const logoutBtn = document.getElementById('logout-btn');
const placeBidBtn = document.getElementById('place-bid-btn');
const bidInput = document.getElementById('bid-input');
const bidMessageEl = document.getElementById('bid-message');
const auctionTimerEl = document.getElementById('auction-timer');
const timerBar = document.getElementById('timer-bar');
const displayBidEl = document.getElementById('display-bid');
const lastBidderEl = document.getElementById('last-bidder');
const currentRacerEl = document.getElementById('current-racer-name');

const teamNameEl = document.getElementById('team-name');
const ownerNameEl = document.getElementById('owner-name');
const remainingBalanceEl = document.getElementById('remaining-balance');
const rosterListEl = document.getElementById('roster-list');
const racersWonEl = document.getElementById('racers-won');
const passbookListEl = document.getElementById('passbook-list');

const teamGridContainer = document.getElementById('team-grid-container');

const rechargeModal = document.getElementById('recharge-modal');
const modalAmountInput = document.getElementById('modal-amount-input');
const modalProofInput = document.getElementById('modal-proof-input');

// --- STATE ---
let currentUserId = null;
let currentTeamName = "";
let currentBalance = 0;
let currentMinBid = 500;
let racersWonCount = 0;
let countdownInterval;
const SVC_TO_USD_RATE = 50;
const tickTockSound = document.getElementById('tick-tock-audio');

// --- AUTH ---
onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        if (AUTHORIZED_ADMIN_UIDS.includes(user.uid)) {
            window.location.href = 'admin.html';
            return;
        }
        setupTeamListener(user.uid);
        setupAuctionFeed();
        setupAllTeamsListener();
        setupPassbookListener(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));

// --- TEAM DATA ---
function setupTeamListener(userId) {
    onSnapshot(doc(db, "teams", userId), (docSnapshot) => {
        if (!docSnapshot.exists()) return;

        const data = docSnapshot.data();
        currentBalance = data.balance || 0;
        currentTeamName = data.teamName || 'N/A';
        const rosterNames = data.roster || [];
        racersWonCount = rosterNames.length;

        teamNameEl.textContent = currentTeamName;
        ownerNameEl.textContent = `Owner:${data.ownerName || 'N/A'}`;
        remainingBalanceEl.textContent = `${currentBalance.toLocaleString()} SVC`;
        racersWonEl.textContent = `${racersWonCount}/6`;

        if (rosterNames.length > 0) {
            const fetchRosterData = async () => {
                const rosterWithPrices = await Promise.all(rosterNames.map(async (name) => {
                    try {
                        const racerDocRef = doc(db, "racers", name);
                        const racerDoc = await getDoc(racerDocRef);
                        const price = racerDoc.exists() ? racerDoc.data().winningBid : 0;
                        return { name, price };
                    } catch (err) {
                        return { name, price: 0 };
                    }
                }));

                rosterListEl.innerHTML = rosterWithPrices.map(r => `
                    <li>
                        <span>${r.name}</span>
                        <span style="color: var(--f1-red); font-family: monospace; font-weight: 800;">
                            ${(r.price || 0).toLocaleString()} SVC
                        </span>
                    </li>
                `).join('');
            };
            fetchRosterData();
        } else {
            rosterListEl.innerHTML = '<li style="border-left:none; background:transparent; color:var(--f1-text-dim)">No racers won yet</li>';
        }
    });
}

// --- PASSBOOK SYSTEM ---
function setupPassbookListener(userId) {
    const q = query(
        collection(db, "transactions"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            passbookListEl.innerHTML = '<div style="color: var(--f1-text-dim); text-align: center; padding: 10px;">No transactions yet</div>';
            return;
        }

        passbookListEl.innerHTML = snapshot.docs.map(doc => {
            const tx = doc.data();
            const date = tx.timestamp ? tx.timestamp.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : "...";
            const isDebit = tx.type === 'Bid';

            return `
                <div class="transaction-item">
                    <div>
                        <span style="font-size: 0.65rem; color: var(--f1-text-dim); display: block;">${date}</span>
                        <span style="font-weight:700; font-size: 0.8rem;">${tx.description}</span>
                    </div>
                    <div style="font-weight:800; color: ${isDebit ? '#ff4444' : '#4ade80'};">
                        ${isDebit ? '-' : '+'}${tx.amount.toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');
    });
}

// --- ALL TEAMS LISTENER ---
function setupAllTeamsListener() {
    onSnapshot(collection(db, "teams"), (querySnapshot) => {
        teamGridContainer.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const roster = data.roster || [];
            const count = roster.length;
            const card = document.createElement('div');
            card.className = `team-card ${doc.id === currentUserId ? 'my-team' : ''}`;

            let dotsHTML = '';
            for(let i=0; i<6; i++) dotsHTML += `<div class="dot ${i < count ? 'filled' : ''}"></div>`;

            card.innerHTML = `
                <div class="card-top">
                    <span class="card-name">${data.teamName || 'Anonymous'}</span>
                    <span class="card-balance">${(data.balance || 0).toLocaleString()} SVC</span>
                </div>
                <span class="roster-label">Roster Slots</span>
                <div class="dots-container">${dotsHTML}</div>
                <div class="card-progress-track">
                    <div class="card-progress-fill" style="width: ${(count / 6) * 100}%"></div>
                </div>
            `;
            teamGridContainer.appendChild(card);
        });
    });
}

// --- AUCTION DATA ---
function setupAuctionFeed() {
    onSnapshot(doc(db, "auctions", "currentRacer"), docSnapshot => {
        if (!docSnapshot.exists()) return;
        const data = docSnapshot.data();
        const currentBid = data.currentBid || 0;

        currentRacerEl.textContent = data.racerName || 'Awaiting...';
        gsap.fromTo(displayBidEl, { scale: 1.2 }, { scale: 1, duration: 0.4 });
        displayBidEl.textContent = `${currentBid.toLocaleString()} SVC`;
        lastBidderEl.textContent = data.lastBidderName ? `Last Bidder: ${data.lastBidderName}` : 'No Bids Yet';

        currentMinBid = currentBid === 0 ? 500 : currentBid + 500;
        bidInput.placeholder = `Min: ${currentMinBid}`;

        if (data.status === 'Sold') {
            bidMessageEl.textContent = `${data.lastSoldRacer} was SOLD!`;
            placeBidBtn.disabled = true;
        } else {
            bidMessageEl.textContent = racersWonCount >= 6 ? "Roster Full (6/6)" : "";
            placeBidBtn.disabled = (racersWonCount >= 6);
        }
        startServerTimer(data.endTime, data.status);
    });
}

// --- TIMER LOGIC ---
function startServerTimer(timerEndsAt, status) {
    clearInterval(countdownInterval);
    if (status !== 'Live' || !timerEndsAt) {
        auctionTimerEl.textContent = "WAITING";
        timerBar.style.width = "100%";
        return;
    }
    const endTime = timerEndsAt.toDate().getTime();
    countdownInterval = setInterval(() => {
        const now = Date.now();
        const distance = endTime - now;
        if (distance > 0) {
            const seconds = Math.floor(distance / 1000);
            auctionTimerEl.textContent = `00:${seconds.toString().padStart(2, '0')}`;
            timerBar.style.width = `${(distance / 60000) * 100}%`;
            if (seconds <= 10) {
                timerBar.style.background = '#ff0000';
                if (tickTockSound.paused) tickTockSound.play();
            } else {
                timerBar.style.background = 'var(--f1-red)';
            }
        } else {
            clearInterval(countdownInterval);
            auctionTimerEl.textContent = "CLOSED";
            timerBar.style.width = "0%";
            placeBidBtn.disabled = true;
            tickTockSound.pause();
        }
    }, 1000);
}

// --- BIDDING ---
placeBidBtn.addEventListener('click', async () => {
    const bidAmount = parseInt(bidInput.value);
    const racerName = currentRacerEl.textContent;

    if (isNaN(bidAmount) || bidAmount < currentMinBid || bidAmount > currentBalance) {
        bidMessageEl.textContent = "Invalid Bid or Insufficient Balance!";
        bidMessageEl.style.color = "var(--f1-red)";
        return;
    }

    placeBidBtn.disabled = true;
    placeBidBtn.textContent = "Bidding...";

    try {
        await runTransaction(db, async (t) => {
            const auctionRef = doc(db, "auctions", "currentRacer");
            const auctionDoc = await t.get(auctionRef);
            const dbBid = auctionDoc.data().currentBid || 0;
            if (bidAmount < (dbBid + 500)) throw "Higher bid already placed";

            t.update(auctionRef, {
                currentBid: bidAmount,
                lastBidderId: currentUserId,
                lastBidderName: currentTeamName,
                endTime: Timestamp.fromMillis(Date.now() + 60000),
                status: 'Live'
            });

            // LOG TRANSACTION
            const txRef = doc(collection(db, "transactions"));
            t.set(txRef, {
                userId: currentUserId,
                type: 'Bid',
                amount: bidAmount,
                description: `Bid on ${racerName}`,
                timestamp: serverTimestamp()
            });
        });
        bidInput.value = '';
        bidMessageEl.textContent = "Bid Successful!";
        bidMessageEl.style.color = "#4ade80";
    } catch (e) {
        bidMessageEl.textContent = "Bid failed: " + e;
        bidMessageEl.style.color = "var(--f1-red)";
    } finally {
        placeBidBtn.disabled = (racersWonCount >= 6);
        placeBidBtn.textContent = "Place Bid";
    }
});

// --- RECHARGE ---
document.getElementById('recharge-btn').addEventListener('click', () => rechargeModal.classList.remove('hidden'));
document.getElementById('modal-cancel-btn').addEventListener('click', () => rechargeModal.classList.add('hidden'));

modalAmountInput.addEventListener('input', () => {
    const val = parseInt(modalAmountInput.value);
    const display = document.getElementById('total-amount-display');
    if (val >= 500) {
        display.classList.remove('hidden');
        document.getElementById('modal-total-amount-usd').textContent = `$${(val / SVC_TO_USD_RATE).toFixed(2)}`;
    } else {
        display.classList.add('hidden');
    }
});

document.getElementById('modal-submit-btn').addEventListener('click', async () => {
    const amt = parseInt(modalAmountInput.value);
    const proof = modalProofInput.value.trim();
    if (amt >= 500 && proof) {
        // 1. Submit Request to Admin
        await addDoc(collection(db, 'rechargeRequests'), {
            userId: currentUserId,
            teamName: currentTeamName,
            svcAmount: amt,
            paymentNote: proof,
            status: 'Pending',
            timestamp: serverTimestamp()
        });

        // 2. Log Pending Recharge to Passbook
        await addDoc(collection(db, 'transactions'), {
            userId: currentUserId,
            type: 'Recharge',
            amount: amt,
            description: `Recharge Request (${proof})`,
            timestamp: serverTimestamp()
        });

        rechargeModal.classList.add('hidden');
        alert("Request Submitted!");
        modalAmountInput.value = '';
        modalProofInput.value = '';
    }
});