# Marker Studio subject model: the training run

## Tonight: E4-kd and E5-kd (decisions 155-157; start here)

Round 6 is judged (E4, E6 and E6-mix passed). Tonight trains two smaller models taught by E6-mix, so TE6's better outlines might come at a faster model's speed. Both start from TRACER's own weights with C1's recipe and round 6's additions, and learn half from their labels and half from E6-mix's maps on every photo (E6-mix is made exactly as 6-results made it: E6's weights blended 0.15 back toward stock TE6).

- **E4-kd**: TE4 (448 px), E4's recipe. About **4 hours**.
- **E5-kd**: TE5 (512 px), D5's late blocks. About **4½ hours**. TE5's weights (126 MB) are downloaded first if they aren't in `work` (fingerprint checked).
- Then **6-results** (about **2 hours**): judges E4-kd and E5-kd beside round 6's candidates by the same rule (the numbers already measured for the earlier models are reused). TE5 hasn't been timed on the iPad yet, so E5-kd can at best be "PASSES pending the iPad timing"; its app file is then in `results\models` for the timing page.

1. Unzip `ms-tonight.zip` into Downloads, over `ms-subject-train` (replace the files it asks about). It adds this kit's new files, `tonight.bat`, and the new bench scripts inside `grid3`; `work`, `results`, `bench-cache` and the photos stay as they are. Nothing new to install.
2. Double-click `ms-subject-train\tonight.bat` **by 9 p.m.** It checks everything is in place first (and keeps a copy of round 6's results as `results-round6` on the PC), then, one after the other:
   1. the one HELD look at X2+cap (about 30 min; don't open `held-look.txt`, Claude reads it);
   2. E6-mix's subject maps and the photo-to-page builder with them (about 1¼ hours);
   3. E4-kd, then E5-kd (about 8½ hours: the window shows the training, the batch each run chose with the teacher counted, and the drive-room check, about 4 GB);
   4. 6-results (about 2 hours);
   5. the kd models' subject maps and the builder with them (about 1¼ hours);
   6. everything gathered in `ms-subject-train\tonight-results`.

   About 13-14 hours in all, so it finishes mid-morning. The same overnight cautions as round 6: PC plugged in and not sleeping, Windows Update paused, no clicks inside the window (if its title starts with "Select", press Esc), nothing opened in `work\runs` or `bench-cache\runs`. If the window is gone (a restart), run `tonight.bat` again: every step carries on where it stopped, and the HELD look is never made twice.
3. When the window says **"All done"**: copy `tonight-results` to the Mac's Claude outputs and tell Claude. That's all, whatever the training's last line said (`results-kd` inside it is 6-results' folder; `s5_train.log` and `tonight-log.txt` say what happened if a run stopped, and Claude says how to carry on).

## Round 6, part 2: training and results (start here, after part 1 has finished)

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. Nothing new to install.
2. Run `5-train.bat` **by 9 p.m.** (about 10 hours; keep the PC plugged in and set not to sleep; it should finish about 7 a.m.). It first checks the drive has room for the night (about 6 GB; if not, it stops at once and says how much to free). It trains E4 (TE4), E6 (TE6), E4b (E4 again with a second seed) and C1+ (C1 carried on), in that order, each pass measured beside C1. If the loss blows up it starts that pass again once by itself and says so. If a run stops (a second blow-up in one pass, the card's memory, or any other error, written in full to `work\s5_train.log`), the window says why and goes on with the next run; running `5-train.bat` again later redoes the stopped one from where it stopped (a full drive stops the night instead, and says so). **It is still running until its last line starts "Step 5"**: until then, leave it, and don't start 6-results. If you must stop it, close the window and tell Claude before running 6-results. Overnight: pause Windows Update; don't click inside the window (a click can pause it: if its title starts with "Select", press Esc); don't open or copy anything in `work\runs`; and keep OneDrive or any backup tool off the `ms-subject-train` folder.
3. In the morning, by the window's last line:
   - **"Step 5 done"**: run `6-results.bat` (below).
   - **"Step 5 NOT finished: every run is trained, but averaging E4 with E4b failed"**: run `5-train.bat` again (about 15 minutes), then 6-results; if it fails again, send Claude `work\s5_train.log`.
   - **"Step 5 NOT finished" naming E4 or E6**: send Claude the window's last lines and `work\s5_train.log` first, and wait. Only if the stop was the card's memory ("ran out of graphics-card memory ... run 5-train again"), run `5-train.bat` again straight away.
   - **"Step 5 NOT finished" naming only E4b or C1+** (it says E4 and E6 are done): tell Claude; 6-results can run now, or 5-train again first finishes the rest (E4b about 2¼ hours, C1+ about ¾).
   - **The drive full, or the room check at the start**: free the space it names and run `5-train.bat` again.

   Then run `6-results.bat` (about 3½-5 hours). If its window closes, run it again: the numbers already measured are kept. Then copy the whole `results` folder to the Mac as **`results-round6`** and tell Claude. Ben decides between passing models with the numbers; then the iPad test build and the 24 photos.

## Round 6, part 1: the new photos (done)

Round 6 trains TE4 and TE6 again with three additions (a set of people photos, pasted small subjects, and round 3's small subjects shown twice), and judges them on new photos. This part only downloads and prepares those photos; the training steps come in the next kit. Nothing earlier is changed: everything new goes into `work\round6` (C1 in `work\runs\C1` and every list stay as they are).

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. Nothing new to install. About 12 GB free space is needed (it checks).
2. Run `4c-prep-round6.bat` (about 1½-3 hours, unattended, no questions). After about 20-45 minutes it writes **`results\round6-people-sheet.jpg`** and says so in the window: 24 people photos, each beside its outline. **Please look at it then, while the rest carries on.** A photo is bad if its outline leaves out a person who is clearly part of the subject (or a clear part of one), or takes in something that isn't a person or what they wear. Small people in the background or cut off at the edge may be left out, and a held thing (a bag, a phone) in or out is fine. Tell Claude how many are bad and their numbers (at least 20 of 24 good passes).
3. When it says "Round 6's photos done", send Claude `results\round6-prep.txt`. The mask zip files in `work\masks` can be deleted then if you need the space. If it stops with a message instead, send Claude that message and `results\round6-prep.txt` (the window's full record is in `work\s4_round6.log`); running it again carries on where it stopped.

## Before round 6: is a bigger model better? (done: round 6 takes both TE4 and TE6)

Round 5's C1 (TRACER-TE4) ships in the iPad test build. Two steps check whether a bigger model would be better for our photos (decisions 104 and 106). Nothing in `work` is changed except the new models' weights and a photo cache; C1 (`work\runs\C1`) is kept and is the benchmark.

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. Nothing new to install.
2. Run `1e-bigger.bat` (it can run before or after step 3; about 45-60 minutes: it downloads TE5, TE6 and TE7, about 570 MB, fingerprints checked; downloads the check photos again at 640 px; then measures seven stock models two ways). Send Claude `results\bigger-round6.txt`: its first line says whether TE5 or TE6 clears the bar fixed before the run.
3. `5c-train-bigger.bat` (it needs nothing run first: it fetches the weights itself) trains C1's recipe on TE5 (D5, about 4-5 hours), then TE6 (D6, about 7-9 hours), each pass measured beside C1. Overnight is fine; it carries on where it stopped if run again. Only one of them: `5c-train-bigger.bat D6`. When it says it's done, copy the `results` folder to the Mac as **`results-bigger`** and tell Claude.

These are C1's recipe only, so the bigger models can be compared with C1 like for like; round 6's own changes (a people set, pasted small subjects) come after.

## Round 5: TE4 and TE2 (done: C1 ships in the iPad test build)

Round 5 trains C1, TRACER-TE4 (input 448), and C2, TRACER-TE2 (352), from their authors' weights with A3's recipe, on round 3's exact photos (kept in `work\round3`). Steps 2-4 are not run: the photos are all prepared. Decisions 88-98e; the plan is in Claude's notes.

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. Nothing new to install.
2. Run `1-check.bat` (it now also fetches TE4's weights if they aren't there, and runs every model once).
3. Run `5-train.bat`: C1 (about 3-4½ hours), then C2 (about 2½ hours). Keep the PC plugged in and set not to sleep; overnight is fine. Each pass's line shows round 3's validation photos and, after a bar, "stock-free (seen)" numbers. **Round 3's validation photos were picked where the old model already agreed, so C1 and C2 will look worse than A3 there: that is expected and is no verdict.** If the card is short of memory it steps the batch down by itself and says so; if it still runs out mid-run, it stops with a message: just run `5-train` again (that run restarts at a smaller batch; a finished run is kept).
4. Only after 5-train has said "Step 5 done", run `6-results.bat` (about 3-4 hours: eleven models and seven reported variants, the TE4 ones at 448 px; 4-5 hours if a candidate ships, as it then also measures it as the app's file on the processor and, for TE4, on full-size photos downloaded again). If the window closes early, run it again: the numbers already measured are kept.
5. Read the top of `results\report.md`:
   - **"NOT FINAL"**: run `5b-train-wide.bat` (it trains only the wide model the report names, about 3-5 hours), then `6-results.bat` again (about an hour: the numbers already measured are kept, so they come out identical).
   - Otherwise it is final. Copy the `results` folder to the Mac (Documents/Claude outputs) as **`results-round5`** and tell Claude.
6. `6b-veto.bat` is only for later, if Claude asks: after the iPad test build, a veto of C1's path hands over to C2's.

Never run `4-label` or `2-lists` in round 5.

## The photo-to-page bench's photos (only when Claude asks; after round 5)

`bench-photos.bat` (about 20 minutes, no graphics card, nothing in `work` changed): picks about 900 photos from the validation and test splits (never the training split) with every object outlined, downloads each as Open Images serves it with its outline images, and writes a `bench-photos` folder (about 150-250 MB) beside this one, with `index.csv` (credits included) and `counts.txt`. Copy the whole `bench-photos` folder to the Mac (Documents/Claude outputs) and tell Claude. Running it again carries on.

## Round 5's third check (done: C1 = TE4)

Decision 98: stock TRACER-TE3 and TE4 (under the 0.50 s limit on the iPad) are measured beside TE2 and TE0, and a rule fixed before the run picks round 5's candidates. It changes nothing in `work` except adding TE3's and TE4's weights (140 MB, fingerprints checked) and a cache of about 2,700 photos in `work\probe5\full`.

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. Nothing new to install.
2. Run `1d-sizes.bat` (about 20–30 minutes: it downloads TE3 and TE4, runs the check detector over the seen subjects, measures four models, then downloads the probe's photos again full size and measures them that way too).
3. Send Claude `results\sizes-round5.txt`. It names C1 (and C2, if any), and says whether decision 98c (preparing every photo again at 448 for TE4) comes to you.

## Round 5's second check (done)

The probe's validation subjects were chosen where stock TE0 already agreed with the outline, so they favour TE0. This check measures both stock models on round 2's seen checks instead, chosen without stock and deciding nothing in step 6: 1,885 subjects and 400 people. It changes nothing in `work`.

1. Unzip this kit over `ms-subject-train` as before, keeping `work` and `results`. (1-check needn't be run again.)
2. Run `1c-seen-check.bat` (about 5 minutes: the check detector looks at the seen subjects first).
3. Send Claude `results\seen-round5.txt`. The rule fixed before the run: if TE2's people overlap is more than 0.010 below TE0's, round 5 shows its people photos twice a pass instead of once.

## Round 5's probe (done: GO)

Before round 5 is built, one short check (decision 94): is TRACER-TE2, as its authors released it, ahead of TRACER-TE0 on our photos at all? It changes nothing in `work`: it only reads round 3's validation photos, outlines and crops in `work\round3`.

1. Unzip this kit **over** your existing `ms-subject-train` folder and let it replace the files. **Keep the `work` and `results` folders as they are.** No new packages.
2. Run `1-check.bat`. It now also downloads TRACER-TE2's weights (45 MB, from the authors' GitHub release, checked against their known fingerprint) and runs both models once.
3. Run `1b-probe.bat` (about 10–15 minutes). It measures stock TE2 and stock TE0 on round 3's validation photos, first checking that stock TE0 comes out exactly as round 3 measured it, then both again as the app's own files would run them (reported only).
4. Send Claude `results\probe-round5.txt`. The rule was fixed before the run: **GO** if TE2 is ahead on the outline or on small subjects found; **STOP** if on neither. Don't run steps 2–6: round 4 stopped at its previews, and round 5's kit comes next only on a GO.

## Round 4 (stopped at its previews: don't run it)

1. Unzip this kit **over** your existing `ms-subject-train` folder and let it replace the files. **Keep the `work` and `results` folders as they are**: round 4 starts from round 3's A3, its lists and its report. The zip contains neither folder.
2. No setup is needed (no new packages), and no downloads: round 4 uses the photos already prepared.
3. Run `4-label.bat` (about 25 minutes: the check detector looks at each candidate photo once). Before anything else it copies round 3's lists, outlines, A3, its sort table and its report into `work\round3` (once, a few minutes; it stops with a message, changing nothing, if they are not there). Then it adds the "disagree" photos: training-pool photos where stock disagreed with the one drawn outline. Stock is only run for the 72 preview photos.
4. Send Claude `results\step4-counts.txt` and the `results\preview\round4-*.jpg` sheets (missed: little or nothing found; wrong edge; "something else picked" was dropped after the first previews, decision 83). On each sheet, green is the drawn outline only, magenta is stock's subject only, pale is both. A group stays if 20 or more of its 24 outlines look right. **Wait for Claude's go-ahead.** If a group fails, Claude names it in `config.json` (`disagree` › `drop`) and you run `4b-lists-again.bat` (a minute or two: no stock, no new previews).
5. Then run `5-train.bat` (about 3–3½ hours: B1, then B1-wide, 8 passes each) and `6-results.bat` (about 50 minutes: six models). Keep the PC plugged in and set not to sleep.
6. Copy the `results` folder to the Mac (Documents/Claude outputs) as **`results-round4`** and tell Claude.

Round 4 trains B1 (A3 carried on, with round 3's photos, its small one-outline photos twice and the disagree photos twice a pass) and B1-wide (the same, more of the backbone trained), and checks stock, A2plus, A3, B1, B1-early (B1 after pass 5) and B1-wide on round 3's fresh check photos. The routes that decide were fixed before the run (config `round4_rule`, and the top of `s6_check.py`): B1 first; if it fails a guard, B1-early is judged; if it holds the guards but isn't shown better than A3, B1-wide is judged; otherwise A3 stays.

## Round 3 (done: A3 ships in v329.2)

1. Unzip this kit **over** your existing `ms-subject-train` folder and let it replace the files. **Keep the `work` folder**: it holds the prepared photos, the check detector, round 2's lists and its trained A2plus, which round 3 compares against. The zip contains no `work` or `results` folder, so nothing in them is replaced.
2. No setup is needed (no new packages).
3. Run `2-lists.bat`. Before anything else it copies round 2's lists, A2plus's weights and the check photos' outlines into `work\round2` (once; it stops with a message, changing nothing, if they are not there). It then keeps training photos it used to leave out only because a smaller outline scored low on Open Images' quality check. A few minutes.
4. Run `3-photos.bat` (only the newly kept photos are downloaded, about 10–15 minutes; it checks there is enough disk space first), then `4-label.bat` (about 35 minutes). When step 4 says "Step 4 done", send Claude `results\step4-counts.txt` and the `results\preview` pictures and **wait for Claude's go-ahead**.
5. Then run `5-train.bat` (about an hour) and `6-results.bat` (about 40 minutes). Keep the PC plugged in and set not to sleep.
6. Copy the `results` folder to the Mac (Documents/Claude outputs) as **`results-round3`** and tell Claude.

Round 3 trains one version, A3 (A2plus's recipe on more photos, with zoomed-out photos and more empty crops; the last passes' weights averaged), and checks stock, round 2's A2plus and A3 on **fresh** check photos that round 2 never used. Round 2's own check photos are measured too, but only reported. The rule that decides was fixed before the run (config `round3_rule`, and the top of `s6_check.py`): A2plus must hold up on the fresh photos, and A3 replaces it only if it is clearly better and no worse anywhere that matters; ties go to A2plus.

## About the kit

This folder trains Marker Studio's own subject finder on your Windows PC's NVIDIA card. It starts from TRACER-TE0 and learns from Open Images' hand-drawn outlines. It then checks the result against stock TRACER and exports it as the app needs it.

**How it runs:**

- **Step by step:** you run the steps in order by double-clicking them. Each one says what it's doing and ends with "Step N done. Next: …".
- **Restartable:** any step can be stopped (close the window) and run again, and it carries on where it stopped.
- **Self-contained:** nothing outside this folder is touched, nothing is deleted outside it, and nothing is uploaded.

**What it contacts:**

- PyPI and download.pytorch.org (setup only);
- github.com, for TRACER's weights, checked against a known fingerprint;
- storage.googleapis.com and open-images-dataset.s3.amazonaws.com (Open Images).

**What you need:**

- about 40 GB free on the drive this folder is on;
- an internet connection that can download roughly 20–40 GB over the run;
- a few minutes of your time per step.

## 1. Before you start (once)

1. **Put the folder somewhere short**, such as `C:\ms-subject-train`. Not inside OneDrive, because syncing the work folder would be slow.
2. **Install Python 3.12** from https://www.python.org/downloads/windows/ (the "Windows installer (64-bit)").
   - On the first screen, tick "Add python.exe to PATH" and keep "py launcher" ticked.
   - Then choose Install Now.
3. **Update the NVIDIA driver:** open the NVIDIA app (or GeForce Experience) › Drivers › Download. Any driver from 2024 or later is fine.

## 2. The steps

| Double-click | What it does | Your time | Runs for |
|---|---|---|---|
| `0-setup.bat` | Makes a private Python environment in this folder and installs PyTorch for your card (about 3 GB) | 1 min | 5–15 min |
| `1-check.bat` | Checks Python, PyTorch, the card and disk space; downloads TRACER's weights (30 MB) | 1 min | 1 min |
| `2-lists.bat` | Downloads Open Images' lists and chooses the photos | 2 min | 5–20 min |
| `3-photos.bat` | Downloads the chosen photos and their outlines, shrinks each photo straight away (the full-size photo is then deleted) | 1 min | 1–3 h |
| `4-label.bat` | Downloads the training photos' box table once (about 1.2 GB), runs stock TRACER on every photo, keeps those where it agrees with the outlines, and makes the check sets | 1 min | 20–40 min |
| `5-train.bat` | Trains the two versions (A2-decoder, A2plus), 12 passes each | 1 min | about 1 h |
| `6-results.bat` | Sets apart check photos with an un-outlined person or object (a COCO detector, used only for this: installs torchvision and downloads its 175 MB weights once), then checks all three models against the held-out photos, exports them, writes the report | 1 min | 30–45 min |

**Answering questions:**

- **Step 2** may ask "Type y and press Enter" before a large download. It tells you the size first.
- **Step 3** may ask the same before the outline files.

Say yes unless your connection is metered.

## 3. What to send back

When step 6 says it's done, copy the whole `results` folder to the Mac, into `Documents/Claude outputs/subject-model`, and tell Claude. Any way works: a USB stick, iCloud Drive, or OneDrive.

**What's in it** (about 30 MB):

- `report.md`: the numbers, and which version (if any) passed;
- `models/`: three model files;
- `sheets/`: side-by-side pictures. Columns: the photo, the hand-drawn outline, stock TRACER, then each trained version. Also the photos where the app's decision changes, and the worst regressions;
- `attribution.csv`: the credit for every photo learnt from;
- `logs/`: each step's log.

The `work` folder (photos, outlines, checkpoints, 5–15 GB) can be deleted once Claude has checked the results.

## If something goes wrong

- **"Python is not installed" or "py is not recognised":** reinstall Python 3.12 with "Add python.exe to PATH" ticked, then run `0-setup.bat` again.
- **"PyTorch cannot see an NVIDIA graphics card":** update the driver (section 1, point 3), restart the PC, and run `0-setup.bat` then `1-check.bat` again.
- **A download stops or times out:** run the same step again; it resumes.
- **Step 3 says photos were skipped:** a few always are, because some Open Images photos have gone from Flickr. Only a stop message matters.
- **Step 4 says too few photos agree:** open `config.json`, change `"train_top_up_zips": 3` to `6`, then run steps 2, 3 and 4 again (already-prepared photos are kept).
- **Step 5 runs out of card memory ("CUDA out of memory"):** open `config.json`, change `"batch": 16` to `8`, and run step 5 again.
- **Anything else:** copy the last lines of the step's window, or the `work\<step>.log` file, to Claude.
