package com.goout.app;

import android.os.Bundle;

/**
 * The small 2x2 variant of {@link SavingsWidget}, shown as a separate entry in
 * the launcher's widget picker. It reuses all of the parent's snapshot reading,
 * rendering, and deep-link wiring; the only difference is it always renders the
 * compact layout regardless of size.
 */
public class CompactSavingsWidget extends SavingsWidget {

    @Override
    protected boolean isCompact(Bundle options) {
        return true;
    }
}
