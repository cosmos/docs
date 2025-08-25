#!/bin/bash

# Unified version management script for documentation
# Combines freeze and create operations with release notes generation

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to get the current development version from versions.json
get_current_version() {
    # Get the first version that isn't "main"
    node -e "
        const fs = require('fs');
        const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
        const currentVersion = versions.versions.find(v => v !== 'main');
        if (currentVersion) {
            console.log(currentVersion);
        }
    " 2>/dev/null
}

# Function to prompt for user confirmation
confirm() {
    local prompt="$1"
    local response

    echo -n "$prompt (y/n): "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Main script
echo ""
echo "======================================"
echo "   Documentation Version Manager"
echo "======================================"
echo ""

# 1. Determine the current version to freeze
CURRENT_VERSION=$(get_current_version)

if [ -z "$CURRENT_VERSION" ]; then
    print_error "No current version found in versions.json"
    print_info "This might be the first version freeze. Please specify the version to freeze."
    echo -n "Enter the version to freeze (e.g., v0.4.0): "
    read -r CURRENT_VERSION

    if [ -z "$CURRENT_VERSION" ]; then
        print_error "Version cannot be empty"
        exit 1
    fi
fi

print_info "Current development version: ${GREEN}$CURRENT_VERSION${NC}"

# 2. Check if the version directory already exists
if [ -d "$CURRENT_VERSION" ]; then
    print_error "Version $CURRENT_VERSION already exists as a frozen version"
    print_info "Frozen versions are immutable. If you need to update, please use a different version."
    exit 1
fi

# 3. Prompt for the new development version
echo ""
echo -n "Enter the new development version (e.g., v0.5.0): "
read -r NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    print_error "New version cannot be empty"
    exit 1
fi

# Validate version format (basic check for v#.#.#)
if ! [[ "$NEW_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_warning "Version format should be v#.#.# (e.g., v0.5.0)"
    if ! confirm "Continue with '$NEW_VERSION' anyway?"; then
        exit 1
    fi
fi

# 4. Check and update release notes if needed
echo ""
print_info "Checking release notes for $CURRENT_VERSION..."

# Check if the version exists in release notes
VERSION_IN_NOTES=false
if [ -f docs/changelog/release-notes.mdx ]; then
    # Check if the current version appears in the release notes
    if grep -q "\"$CURRENT_VERSION\"" docs/changelog/release-notes.mdx 2>/dev/null; then
        VERSION_IN_NOTES=true
        print_success "Release notes already contain $CURRENT_VERSION"
    fi
fi

# If version is not in release notes, update them
if [ "$VERSION_IN_NOTES" = false ]; then
    print_warning "$CURRENT_VERSION not found in release notes"
    print_info "Fetching release notes from cosmos/evm latest release..."

    # Fetch from latest release (which should contain the version we're freezing)
    if ./scripts/versioning/refresh-release-notes.sh latest; then
        # Check again if the version is now present
        if [ -f docs/changelog/release-notes.mdx ] && grep -q "\"$CURRENT_VERSION\"" docs/changelog/release-notes.mdx 2>/dev/null; then
            print_success "Release notes updated successfully with $CURRENT_VERSION"
            VERSION_COUNT=$(grep -c '<Update' docs/changelog/release-notes.mdx || true)
            print_info "Release notes now contain $VERSION_COUNT versions"
        else
            print_warning "$CURRENT_VERSION still not in release notes after update"
            print_info "This might be normal if the version hasn't been released in cosmos/evm yet"

            if ! confirm "Continue without $CURRENT_VERSION in release notes?"; then
                print_info "You can manually update the release notes before running this script again"
                exit 1
            fi
        fi
    else
        print_error "Failed to fetch release notes from cosmos/evm"
        if ! confirm "Continue without updating release notes?"; then
            exit 1
        fi
    fi
else
    # Version exists, but offer to update anyway in case there are newer versions
    if confirm "Would you like to check for newer versions in the changelog?"; then
        print_info "Fetching latest release notes from cosmos/evm..."
        if ./scripts/versioning/refresh-release-notes.sh latest; then
            VERSION_COUNT=$(grep -c '<Update' docs/changelog/release-notes.mdx || true)
            print_success "Release notes refreshed ($VERSION_COUNT versions total)"
        else
            print_warning "Failed to refresh release notes, continuing with existing"
        fi
    fi
fi

# 5. Display summary and confirm
echo ""
echo "======================================"
echo "   Version Management Summary"
echo "======================================"
echo ""
echo "  Freeze version:  ${YELLOW}$CURRENT_VERSION${NC} (becomes immutable)"
echo "  New dev version: ${GREEN}$NEW_VERSION${NC} (for future development)"
echo ""
echo "This will:"
echo "  1. Create a frozen copy of docs/ at $CURRENT_VERSION/"
echo "  2. Snapshot EIP data from Google Sheets"
echo "  3. Convert EIP reference to use static snapshot in frozen version"
echo "  4. Update all internal links in the frozen version"
echo "  5. Update navigation and version registry"
echo "  6. Set $NEW_VERSION as the new development version"
echo ""

if ! confirm "Proceed with version management?"; then
    print_info "Operation cancelled"
    exit 0
fi

# 6. Execute the freeze operation
echo ""
print_info "Starting version freeze for $CURRENT_VERSION..."

# Create version directory
print_info "Creating version directory..."
cp -r docs/ "$CURRENT_VERSION/"

# 7. Handle EIP reference data snapshot using Google Sheets API
print_info "Processing EIP reference data..."

# Check if Google Sheets API dependencies are installed
if [ ! -d "scripts/versioning/node_modules/googleapis" ]; then
    print_warning "Google Sheets API dependencies not installed"
    print_info "Installing dependencies..."
    (cd scripts/versioning && npm install) || {
        print_warning "Failed to install dependencies"
        print_info "Continuing without Google Sheets snapshot"
    }
fi

# Create a new sheet tab in Google Sheets for this version
if node scripts/versioning/snapshot-eip-sheet.js "$CURRENT_VERSION"; then
    print_success "Created Google Sheets tab for $CURRENT_VERSION"
    
    # Update the EIP compatibility table component with the new GID mapping
    print_info "Updating EIP component with new GID mapping..."
    if node scripts/versioning/update-eip-component-gids.js "$CURRENT_VERSION"; then
        print_success "Updated EIP component with GID for $CURRENT_VERSION"
    else
        print_warning "Failed to update EIP component GID mapping"
    fi
    
    # Generate the MDX file that imports the component with sheet tab prop
    print_info "Generating MDX with sheet tab reference..."
    if node scripts/versioning/generate-eip-mdx-simple.js "$CURRENT_VERSION"; then
        print_success "EIP reference page updated to use versioned sheet tab"
        # Clean up the sheet reference file
        rm -f "$CURRENT_VERSION/eip-sheet-reference.json"
        print_success "Cleaned up temporary reference file"
    else
        print_warning "Failed to generate sheet-specific MDX file"
        print_info "Falling back to JSON snapshot approach..."
        # Fallback to JSON snapshot approach
        if node scripts/versioning/snapshot-eip-data.js "$CURRENT_VERSION"; then
            print_success "EIP data snapshot saved to $CURRENT_VERSION/eip-data-snapshot.json"
            if node scripts/versioning/generate-simple-eip-mdx.js "$CURRENT_VERSION"; then
                print_success "EIP reference page converted to static with embedded JSON data"
                rm -f "$CURRENT_VERSION/eip-data-snapshot.json"
            fi
        fi
    fi
else
    print_warning "Failed to create Google Sheets snapshot"
    print_info "The frozen version will keep the dynamic component pointing to main sheet"
fi

# 8. Update all internal links in the versioned files (but NOT snippet imports)
print_info "Updating internal links..."
find "$CURRENT_VERSION" -name "*.mdx" -type f -exec sed -i '' "s|/docs/|/$CURRENT_VERSION/|g" {} \;

# Note: We keep snippet imports pointing to the central /snippets/ directory
# This avoids duplicating components across versions

# 9. Update navigation structure
print_info "Updating navigation..."
if [ -f scripts/versioning/update-navigation.js ]; then
    node scripts/versioning/update-navigation.js "$CURRENT_VERSION"
fi

# 10. Update versions registry with the new version
print_info "Registering new development version $NEW_VERSION..."
node scripts/versioning/update-versions.js add "$NEW_VERSION"

# Update docs.json structure if restructure script exists
if [ -f scripts/versioning/restructure-navigation.js ]; then
    print_info "Restructuring docs.json for clarity..."
    node scripts/versioning/restructure-navigation.js
fi

# 11. Create a marker file in the frozen version
echo "$CURRENT_VERSION - Frozen on $(date '+%Y-%m-%d')" > "$CURRENT_VERSION/.version-frozen"

# Add metadata about the freeze
cat > "$CURRENT_VERSION/.version-metadata.json" << EOF
{
  "version": "$CURRENT_VERSION",
  "frozenDate": "$(date '+%Y-%m-%d')",
  "frozenTimestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "nextVersion": "$NEW_VERSION",
  "eipSnapshotType": "google-sheets-tab",
  "eipSheetTab": "$CURRENT_VERSION"
}
EOF

# 12. Display completion message
echo ""
print_success "Version management completed successfully!"
echo ""
echo "======================================"
echo "   Status"
echo "======================================"
echo ""
echo "  ${GREEN}✓${NC} Version $CURRENT_VERSION has been frozen (immutable)"
echo "  ${GREEN}✓${NC} Development continues on version $NEW_VERSION"
echo "  ${GREEN}✓${NC} Navigation and registry updated"
if [ -f "$CURRENT_VERSION/documentation/evm-compatibility/eip-reference.mdx" ] && grep -q "sheetTab=\"$CURRENT_VERSION\"" "$CURRENT_VERSION/documentation/evm-compatibility/eip-reference.mdx"; then
    echo "  ${GREEN}✓${NC} EIP reference using Google Sheets tab: $CURRENT_VERSION"
elif [ -f "$CURRENT_VERSION/documentation/evm-compatibility/eip-reference.mdx" ] && grep -q "const data =" "$CURRENT_VERSION/documentation/evm-compatibility/eip-reference.mdx"; then
    echo "  ${GREEN}✓${NC} EIP reference data embedded in frozen MDX"
fi
if [ -f docs/changelog/release-notes.mdx ] && grep -q "\"$CURRENT_VERSION\"" docs/changelog/release-notes.mdx 2>/dev/null; then
    echo "  ${GREEN}✓${NC} Release notes include $CURRENT_VERSION"
fi
echo ""
echo "======================================"
echo "   Next Steps"
echo "======================================"
echo ""
echo "  1. Review the changes:"
echo "     ${BLUE}git status${NC}"
echo ""
echo "  2. Stage and commit the changes:"
echo "     ${BLUE}git add -A${NC}"
echo "     ${BLUE}git commit -m \"docs: freeze $CURRENT_VERSION and begin $NEW_VERSION development\"${NC}"
echo ""
echo "  3. Push to repository:"
echo "     ${BLUE}git push${NC}"
echo ""
echo "  4. Continue development in docs/ for version $NEW_VERSION"
echo ""
echo "======================================"
echo "   Important Reminders"
echo "======================================"
echo ""
echo "  ${YELLOW}⚠${NC}  The $CURRENT_VERSION/ directory is now frozen"
echo "  ${YELLOW}⚠${NC}  Avoid editing files in $CURRENT_VERSION/ to maintain historical accuracy"
echo "  ${YELLOW}⚠${NC}  All new development should happen in docs/"
echo "  ${YELLOW}⚠${NC}  The EIP reference in $CURRENT_VERSION uses a versioned Google Sheets tab"
echo ""
echo "  When ready for the next release (e.g., v0.6.0):"
echo "  Run: ${BLUE}./scripts/versioning/version-manager.sh${NC}"
echo ""