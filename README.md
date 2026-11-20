# Hand Cricket

A free team game for 2 to 12 players. Everyone plays from their own phone with a room code. No packages and no accounts for players.

## Put it online with Render (free)

Use a NEW GitHub repository for this game, so it does not mix with Bluff Party.

1. On github.com create a new public repository, for example `hand-cricket`.
2. Upload `hand-cricket.js`, `package.json` and `README.md` (Add file, then Upload files, then Commit changes).
3. On render.com choose New, then Web Service, and pick the repository.
4. Language: `Node`. Build Command: `npm install`. Start Command: `npm start`. Instance type: Free.
5. When it is live you get an address ending in `.onrender.com`.

## Play

- Optional big screen: open `YOUR-ADDRESS/host`. It shows the room code and the live scoreboard.
- Everyone else opens `YOUR-ADDRESS` on their phone, types the room code and a name, then taps Team A or Team B.
- The first player to join a team is its captain.
- The first person to join the room (or the big screen) taps Start match and picks the overs.

## Rules

1. Toss: one captain is picked at random to call odd or even. Both captains then have 5 seconds to pick a number from 0 to 10. If the total matches the call, the calling team wins the toss, otherwise the other team wins. The toss winner bats first.
2. Lineups: the batting captain sets the batting order and the bowling captain sets the bowling order. Orders left unset when the 60 seconds end use join order.
3. Each ball: the batter and the bowler each have 5 seconds to tap a number from 0 to 10. No pick counts as 0.
   - Same number: the batter is OUT.
   - Different numbers: the batter's number is added to the team score.
   - Batter plays 0 and bowler plays a number above 0: the bowler's number is added to the score.
4. An over is 6 balls, and each over is bowled by the next bowler in the bowling order.
5. An innings ends when the overs are finished or every batter is out.
6. The second team chases the target (first team's score plus 1). A tie is possible.

Free hosting can go to sleep after 15 minutes without use and takes about a minute to wake up. Open the address a minute or two before the game.
