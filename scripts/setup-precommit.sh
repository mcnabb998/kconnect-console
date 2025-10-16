#!/bin/bash

# Pre-commit setup script for kconnect-console

echo "Setting up pre-commit hooks..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "pre-commit is not installed. Installing via pip..."
    pip install pre-commit
fi

# Install the git hook scripts
echo "Installing pre-commit hooks..."
pre-commit install

# Run against all files once to make sure everything works
echo "Running pre-commit against all files..."
pre-commit run --all-files

echo "✅ Pre-commit hooks are now set up!"
echo ""
echo "From now on, these checks will run automatically before each commit:"
echo "  - Go tests and formatting"
echo "  - React tests and TypeScript checking"
echo "  - Code formatting and linting"
echo ""
echo "To manually run the hooks: pre-commit run --all-files"