# iCamp Contextual Help Source of Truth

## Requirement

Every meaningful section, form, input sheet and workflow should expose contextual help through an accessible circular **ⓘ** information control.

The help system has two levels:

1. **Inline help** — short guidance inside the current workflow.
2. **Full help page** — a separate help article with examples, common mistakes and related topics.

## UI contract

The ⓘ control must:
- be keyboard accessible;
- have a meaningful accessible name;
- be large enough for touch use;
- sit beside/within the section heading or field group;
- open inline guidance without destroying form state;
- offer a link to the full help article.

## Help topic model

Each help topic has:
- stable topic ID;
- title;
- summary;
- detailed content;
- audience/classification;
- related topics;
- route/slug.

UI sections register a topic ID rather than embedding unrelated duplicate help text.

## Classification

### Public/guest
Safe for unauthenticated/public use.

### Operational
Requires staff access to the related feature.

### Privileged
Admin/I.T./finance/security guidance; never public by default.

## Content quality

Help should answer:
- What is this section?
- What should I enter/do?
- Why does it matter?
- What is an example?
- What mistakes should I avoid?
- What related help is available?

## Maintenance

Every applicable future UI build must:
- register contextual help;
- verify its ⓘ control;
- update help when the workflow changes.

A section without contextual help is considered incomplete unless explicitly documented as not requiring user guidance.
