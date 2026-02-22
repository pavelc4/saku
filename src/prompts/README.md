# SAKU AI Insights Config

Edit `insights.config.json` to customize AI behavior.
No code changes needed — redeploy after editing.

| Field             | Options                      | Effect                                                 |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| tone              | formal / casual / friendly   | Language style of AI response                          |
| verbosity         | brief / detailed             | Length of response                                     |
| show_tips         | true / false                 | Whether to include practical tips                      |
| max_tips          | 1 / 2 / 3                    | Max number of tips (if show_tips: true)                |
| include_warning   | true / false                 | Flag overspending categories                           |
| include_positive  | true / false                 | Always mention a positive first                        |
| focus             | spending / saving / balanced | What aspect to emphasize                               |
| personality       | id / en strings              | The AI persona description                             |
| greetings         | id / en strings              | Opening line per language (use `{name}` for user name) |
| closing           | id / en strings              | Closing line per language (use `{name}` for user name) |
| forbidden_phrases | id / en array                | Phrases the AI should actively avoid using             |
| boundaries        | string[]                     | Hard rules AI must never violate                       |
