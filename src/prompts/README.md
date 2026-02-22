# SAKU AI Insights Config

Edit `insights.config.json` to customize AI behavior.
No code changes needed — redeploy after editing.

| Field            | Options                      | Effect                                  |
| ---------------- | ---------------------------- | --------------------------------------- |
| tone             | formal / casual / friendly   | Language style of AI response           |
| verbosity        | brief / detailed             | Length of response                      |
| show_tips        | true / false                 | Whether to include practical tips       |
| max_tips         | 1 / 2 / 3                    | Max number of tips (if show_tips: true) |
| include_warning  | true / false                 | Flag overspending categories            |
| include_positive | true / false                 | Always mention a positive first         |
| focus            | spending / saving / balanced | What aspect to emphasize                |
| greetings        | id / en strings              | Opening line per language               |
| closing          | id / en strings              | Closing line per language               |
| boundaries       | string[]                     | Hard rules AI must never violate        |
