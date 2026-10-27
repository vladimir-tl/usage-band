# usage-band

A Claude Code mod that adds a narrow pane beside the transcript with the
current model and effort, the context window, your subscription usage limits
(the 5-hour and weekly windows, how much of each is used and when it resets)
and the agents running now.

```
Opus 5.5
effort high

Ctx ████░░░░░░ 42%
84k / 200k

5h █░░░░░░░░░ 6%
resets in 50m

Week ███░░░░░░░ 29%
resets in 3d 4h

Agents 2
· Explore auth flow
· Run test suite
```

The pane opens by itself when a session starts, docked to the right in
fullscreen from 144 columns; `/usage-band` opens it again after it is closed
(docked from 110 columns, above the prompt below that).

The figures are the ones the status line uses. They refresh after each response
and every minute, the agents every 5 seconds. The context and each limit window
are light green, turn yellow from 70% and red from 90%. Effort shows once the
first response of the session is in. Without a subscription there are no limit
windows, so they are left out.

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

## License

MIT, see [LICENSE](LICENSE).
