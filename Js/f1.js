const drivers = [
    { rank: 1, name: "Max Verstappen", team: "Red Bull", points: 119, wins: 3, podiums: 5 },
    { rank: 2, name: "Sergio Perez", team: "Red Bull", points: 105, wins: 5, podiums: 4 },
    { rank: 3, name: "Fernando Alonso", team: "Aston Martin", points: 75, wins: 0, podiums: 4 },
    { rank: 4, name: "Lewis Hamilton", team: "Mercedes", points: 56, wins: 0, podiums: 1 },
    { rank: 5, name: "Carlos Sainz", team: "Ferrari", points: 44, wins: 0, podiums: 0 }
];

const tableBody = document.getElementById('standings-body');

drivers.forEach(d => {
    const row = `
        <tr>
            <td class="rank">${d.rank}</td>
            <td>
                <span class="driver-name">${d.name}</span>
                <span class="team-name">${d.team}</span>
            </td>
            <td>${d.points}</td>
            <td>${d.wins}</td>
            <td>${d.podiums}</td>
        </tr>
    `;
    tableBody.innerHTML += row;
});