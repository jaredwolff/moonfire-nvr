// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2024 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
} from "@mui/material";
import * as api from "../api";
import { useSnackbars } from "../snackbars";

interface Props {
  storageDir?: api.StorageDir;
  onClose: () => void;
  onSuccess: () => void;
  csrf?: string;
}

const DeleteDialog = ({ storageDir, onClose, onSuccess, csrf }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snackbars = useSnackbars();

  const handleDelete = async () => {
    if (!storageDir) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.deleteStorageDir(
        storageDir.id,
        {
          csrf,
        },
        {}
      );

      switch (result.status) {
        case "aborted":
          break;
        case "error":
          setError(result.message);
          break;
        case "success":
          snackbars.enqueue({
            message: "Storage directory deleted successfully",
            key: "storage-delete-success",
          });
          onSuccess();
          onClose();
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onClose();
      setError(null);
    }
  };

  const hasActiveStreams = storageDir && storageDir.streamsUsing.length > 0;

  return (
    <Dialog open={!!storageDir} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Storage Directory</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {hasActiveStreams && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Cannot delete storage directory:</strong>
            <br />
            This directory is currently being used by {storageDir.streamsUsing.length} stream(s).
            Please remove or reassign all streams before deleting.
          </Alert>
        )}

        {storageDir && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to delete this storage directory?
            </Typography>

            <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1, mt: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                Path: {storageDir.path}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {storageDir.id} • UUID: {storageDir.uuid}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Used: {(storageDir.usedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
              </Typography>
            </Box>

            {!hasActiveStreams && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <strong>Warning:</strong> This action cannot be undone. The directory
                configuration will be removed from Moonfire NVR, but the actual files
                on disk will remain. You may need to manually clean up the directory
                if desired.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={submitting || hasActiveStreams}
        >
          {submitting ? "Deleting..." : "Delete Directory"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDialog;
