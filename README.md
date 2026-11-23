# Hand Cricket

A free team cricket game for 2 to 24 players. One person hosts on a laptop or TV, everyone else plays from their own phone with a room code. No packages and no accounts for players. Sounds, animations and confetti all run in the browser, so the server stays light.

## Put it online with Render (free)

Use a NEW GitHub repository for this game.

1. On github.com create a new repository, for example `hand-cricket`.
2. Upload `hand-cricket.js`, `package.json` and `README.md` (Add file, then Upload files, then Commit changes).
3. On render.com choose New, then Web Service, and pick the repository.
4. Language: `Node`. Build Command: `npm install`. Start Command: `npm start`. Instance type: Free.
5. When it is live you get an address ending in `.onrender.com`.

## Play

- Host: open `YOUR-ADDRESS/host` (or tap Host a game). You see the room code, the settings and the player list.
- Players: open `YOUR-ADDRESS` on their phones, type the room code and a name, then pick a team.
- Host settings (before the start): single match or tournament (3 to 6 teams), overs, seconds per ball, powerplay (off, or the first 1 to 3 overs, with runs x2 or x3), super over on a tie, and team names. Captains can rename their own team. The host can also lock the room, move or remove players, pick captains and close the room.
- Tournament (IPL style): everyone plays everyone once (win 2 points, tie 1, net run rate breaks ties). The top two meet in the final, and the winner gets the trophy screen with Orange Cap, Purple Cap and most valuable player.
- A tie goes to a super over (one over each, 2 wickets, up to 3 times).
- The number buttons are shuffled on every ball for every player, so nobody can read a pick from finger movement.
- The Stats tab keeps each player's totals for the whole room. After each match you get a scorecard, charts and Player of the Match.
- The speaker button turns sounds on or off. The microphone button turns spoken commentary on or off (on for the host screen by default).

## Rules in short

1. Toss: one captain calls odd or even, both captains pick 0 to 10, the total decides the toss winner, who chooses to bat or bowl.
2. Captains set the batting and bowling order.
3. Each ball: batter and bowler pick 0 to 10 in time (no pick = 0). Same number is OUT. Otherwise the batter's number is added; if the batter plays 0 and the bowler plays more, the bowler's number is added. Powerplay overs multiply the runs.
4. A batter out without scoring gets a duck (golden duck on the first ball).
5. The second team chases the target (first score plus 1).

Free hosting sleeps after 15 minutes without use and takes about a minute to wake up. Open the address a minute or two before the game.
