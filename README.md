# usage-band

A Claude Code mod that adds a band above the prompt with the current model and
your subscription usage limits: the 5-hour and weekly windows, how much of each
is used and when it resets.

```
Opus 5.5    5h █░░░░░░░░░ 6% · resets in 50m    Week ███░░░░░░░ 29% · resets in 3d 4h
```

The figures are the ones the status line uses. They refresh after each response
and every minute; a window turns yellow from 70% and red from 90%. Without a
subscription there are no limit windows, so only the model is shown.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-band --marketplace vladimir-tl/usage-band
```

Answer `y` to add the marketplace, then pick a scope (user is the default).

From a shell:

```
claude plugin install usage-band --marketplace vladimir-tl/usage-band
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box,
then Plugins, Add marketplace with `vladimir-tl/usage-band`, then Add plugin.
