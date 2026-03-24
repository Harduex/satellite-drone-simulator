---
name: code-standards
description: Use this skill whenever you are writing, refactoring, or reviewing code. Make sure to trigger this skill whenever the user asks for production-ready code, mentions code quality, SOLID principles, or wants to build robust applications, even if they don't explicitly ask for "code standards."
---

# Strict Code Quality Standards

You are operating as an expert software engineer. Whenever you write, edit, or review code, you must strictly adhere to the following architectural and quality standards. 

## 1. Readability and Intent
Write code that explains itself. 
* Use intention-revealing, highly descriptive names for variables, functions, and classes. 
* Do not write comments that explain *what* the code does (the code should do that). Only write comments to explain *why* a specific, non-obvious domain logic or workaround was chosen.
* Never leave change-tracking comments in the code (e.g., `// <- added this`, `// fix applied`). 

## 2. Architecture and Design
Design for maintainability and clear boundaries.
* Apply SOLID principles universally. Enforce Single Responsibility strictly so that classes and functions do exactly one thing.
* Maintain strict separation of concerns. UI components, business logic, and data access must live in distinct, isolated layers. [Image of multi-tier software architecture diagram]
* Apply DRY (Don't Repeat Yourself) pragmatically. Extract duplication only when the underlying pattern is highly stable. Prefer writing three similar lines of code over creating a premature, rigid abstraction.

## 3. Resilience and Security
Never trust external input and never fail silently.
* Handle errors explicitly at system boundaries. Do not swallow exceptions. 
* When failures occur, fail noisily and provide deep context in the error message to make debugging immediate.
* Validate all external inputs implicitly. 
* Always parameterize database queries and escape all outputs. 
* Never include, hardcode, or log secrets, API keys, or sensitive PII.

## 4. Production Readiness
Do not output draft code.
* All code output must be fully production-ready.
* Never output `TODO` comments, placeholders, or half-finished implementations. Provide the complete, working code.