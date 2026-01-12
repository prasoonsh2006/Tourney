import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, runTransaction, Timestamp, addDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- CONFIGURATION ---

// 🚨 REPLACE WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCFA20hwEGRGXeiX0LrPKhc-VL5K4umGv0", // Your actual key
    authDomain: "souls-of-soulcity.firebaseapp.com",
    projectId: "souls-of-soulcity",
    storageBucket: "souls-of-soulcity.firebaseapp.com",
    messagingSenderId: "402427120355",
    appId: "1:402427120355:web:f0fa030a0a9034198213d6"
};

// 🚨 REPLACE WITH YOUR ADMIN USER'S UID
const AUTHORIZED_ADMIN_UIDS = ["8boxpeVzXUg299rHWXdZseORad92"];

// --- INITIALIZATION ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONSTANTS ---
const SVC_TO_USD_RATE = 50; // 1 SVC = $50

// --- DOM ELEMENTS ---
const logoutBtn = document.getElementById('logout-btn');
const placeBidBtn = document.getElementById('place-bid-btn');
const bidInput = document.getElementById('bid-input');
const bidMessageEl = document.getElementById('bid-message');
const auctionTimerEl = document.getElementById('auction-timer');
const ownerNameEl = document.getElementById('owner-name');
const remainingBalanceEl = document.getElementById('remaining-balance');
const teamNameEl = document.getElementById('team-name');
const rechargeBtn = document.getElementById('recharge-btn');
const currentRacerEl = document.getElementById('current-racer-name');
const odometerContainerEl = document.getElementById('odometer-container');
const lastBidderEl = document.getElementById('last-bidder');
const rosterListEl = document.getElementById('roster-list');
const racersWonEl = document.getElementById('racers-won');

// 🎯 NEW MODAL DOM ELEMENTS
const rechargeModal = document.getElementById('recharge-modal');
const modalAmountInput = document.getElementById('modal-amount-input');
const modalProofInput = document.getElementById('modal-proof-input');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const modalError = document.getElementById('modal-error');
const totalAmountDisplay = document.getElementById('total-amount-display');
// We now only use the USD display in the final total
// const modalTotalAmountSVC = document.getElementById('modal-total-amount-svc'); 
const modalTotalAmountUSD = document.getElementById('modal-total-amount-usd');


// --- STATE VARIABLES ---
let currentUserId = null;
let currentTeamName = "Loading...";
let currentBalance = 0;
let currentMinBid = 0;
let racersWonCount = 0;
let countdownInterval;
// 🎯 State variable to track the bid for the odometer effect
let previousBidValue = 0;
// 🎯 State variables for audio control
let tickSoundPlaying = false;
const tickTockSound = document.getElementById('tick-tock-audio');




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
            teamNameEl.textContent = "N/A";
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
        teamNameEl.textContent = teamData.teamName || 'N/A';
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
            // 1. Set the text content
            bidMessageEl.textContent = "Roster is full (6/6). You cannot bid on new racers.";
            // 2. Set the color style to 'red'
            bidMessageEl.style.color = "red";
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
        // 2. Set the color style to 'red'
        bidMessageEl.style.color = "red";
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

// --- TIMER LOGIC (MODIFIED) ---

// --- TIMER LOGIC (MODIFIED) ---

function startServerTimer(timerEndsAt, status) {
    if (status !== 'Live' || !timerEndsAt || racersWonCount >= 6) {
        auctionTimerEl.textContent = "Auction Pending";
        placeBidBtn.disabled = true;

        // 🛑 STOP sound if auction is not live
        if (tickSoundPlaying) {
            tickTockSound.pause();
            tickTockSound.currentTime = 0; // Reset for next time
            tickSoundPlaying = false;
        }
        return;
    }

    clearInterval(countdownInterval);
    const endTime = timerEndsAt.toDate().getTime();

    countdownInterval = setInterval(() => {
        const distance = endTime - Date.now();
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (distance > 0) {
            auctionTimerEl.textContent = `${seconds.toString().padStart(2, '0')}s`;

            // 🚀 MODIFIED LOGIC: Flash Red and Start Ticking for the last 5 seconds
            if (seconds <= 10 && seconds >= 0) {
                auctionTimerEl.style.color = "#FF0000"; // Pure Red for high drama

                // 🔊 START TICKING SOUND
                if (!tickSoundPlaying) {
                    // Start playback and mark state
                    tickTockSound.play().catch(e => console.error("Error playing sound:", e));
                    tickSoundPlaying = true;
                }

            } else {
                auctionTimerEl.style.color = ""; // Reset color to default (white/light)

                // 🔇 STOP TICKING SOUND
                if (tickSoundPlaying) {
                    tickTockSound.pause();
                    tickTockSound.currentTime = 0; // Rewind the audio
                    tickSoundPlaying = false;
                }
            }

            placeBidBtn.disabled = (racersWonCount >= 6);

        }
        else {
            // TIME EXPIRED logic
            clearInterval(countdownInterval);
            auctionTimerEl.textContent = "TIME EXPIRED";
            auctionTimerEl.style.color = "#FF0000"; // Time Expired Red
            placeBidBtn.disabled = true;

            // 🔇 STOP TICKING SOUND when time expires
            if (tickSoundPlaying) {
                tickTockSound.pause();
                tickTockSound.currentTime = 0;
                tickSoundPlaying = false;
            }


            // Server process must handle the final sale.
        }
    }, 1000); // Check and update every second
}
// 🎯 --- CUSTOM MODAL HANDLERS (UPDATED for 1 SVC = $50) ---

// Listener for real-time total amount calculation
modalAmountInput.addEventListener('input', () => {
    const svcAmount = parseInt(modalAmountInput.value);

    // Update placeholder to show the rate
    modalAmountInput.placeholder = `e.g., 5000 (1 SVC = $${SVC_TO_USD_RATE})`;

    if (svcAmount >= 500) {
        const usdAmount = svcAmount * SVC_TO_USD_RATE;

        // Display calculated USD amount, formatted as currency
        modalTotalAmountUSD.textContent = usdAmount.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        totalAmountDisplay.classList.remove('hidden');
    } else {
        // Reset and hide the total display if the amount is too low or cleared
        totalAmountDisplay.classList.add('hidden');
        modalTotalAmountUSD.textContent = '$0';
    }

    // Clear the error message on new input
    modalError.classList.add('hidden');
    modalError.textContent = '';
});


// Handler to open the modal (resetting the new USD element and setting rate)
rechargeBtn.addEventListener('click', () => {
    // Clear previous state and show modal
    modalAmountInput.value = '';
    modalProofInput.value = '';
    modalError.textContent = '';
    modalError.classList.add('hidden');

    // Set placeholder to show the exchange rate
    modalAmountInput.placeholder = `e.g., 5000 (1 SVC = $${SVC_TO_USD_RATE})`;

    // Reset and hide total display when opening
    modalTotalAmountUSD.textContent = '$0';
    totalAmountDisplay.classList.add('hidden');

    rechargeModal.classList.remove('hidden');
    bidMessageEl.textContent = 'Awaiting input for recharge...';
});

// Handler to close the modal
modalCancelBtn.addEventListener('click', () => {
    rechargeModal.classList.add('hidden');
    bidMessageEl.textContent = 'Recharge request cancelled.';
});


// --- RECHARGE LOGIC (SUBMISSION) ---

modalSubmitBtn.addEventListener('click', async () => {
    const requestedAmount = parseInt(modalAmountInput.value);
    const paymentProof = modalProofInput.value.trim();

    modalError.classList.add('hidden');
    modalError.textContent = '';

    // 1. Validation for Amount
    if (isNaN(requestedAmount) || requestedAmount < 500) {
        modalError.textContent = "Invalid amount. Please enter a number that is 500 SVC or greater.";
        modalError.classList.remove('hidden');
        return;
    }

    // 2. Validation for Payment Proof
    if (!paymentProof) {
        modalError.textContent = "Please enter a payment transaction ID or note.";
        modalError.classList.remove('hidden');
        return;
    }

    // Disable button to prevent double submission and provide feedback
    modalSubmitBtn.disabled = true;
    modalSubmitBtn.textContent = 'Submitting...';

    try {
        await addDoc(collection(db, 'rechargeRequests'), {
            userId: currentUserId,
            teamName: currentTeamName,
            svcAmount: requestedAmount,
            paymentNote: paymentProof,
            status: 'Pending',
            timestamp: Timestamp.now()
        });

        // Success
        bidMessageEl.textContent = `✅ Request for ${requestedAmount.toLocaleString()} SVC submitted. Awaiting Admin approval.`;
        rechargeModal.classList.add('hidden'); // Hide modal on success

    } catch (e) {
        // Failure
        console.error("Error submitting recharge request:", e);
        bidMessageEl.textContent = "❌ Failed to submit request.";

        // Show error in modal
        modalError.textContent = "Failed to submit request. Please try again.";
        modalError.classList.remove('hidden');
    } finally {
        // Re-enable button
        modalSubmitBtn.disabled = false;
        modalSubmitBtn.textContent = 'Submit Request';
    }
});