-- 24-Hour Train Replay: one row per railroad per UTC hour (hour = epoch ms / 3600000), samples appended each minute.
-- w = writes made to this row, booked = how many of them are already added to the shared budget row.
CREATE TABLE IF NOT EXISTS replay_hour (
  hour INTEGER NOT NULL,
  rr TEXT NOT NULL,
  ids TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  w INTEGER NOT NULL DEFAULT 0,
  booked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour, rr)
) WITHOUT ROWID;
