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
import { CameraManagement } from "../types";

interface Props {
  cameraToDelete?: CameraManagement;
  onClose: () => void;
  refetch: () => void;
  csrf?: string;
}

const DeleteDialog = ({ cameraToDelete, onClose, refetch, csrf }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snackbars = useSnackbars();

  if (!cameraToDelete) {
    return null;
  }

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.deleteCamera(cameraToDelete.uuid, { csrf }, {});

      switch (result.status) {
        case "aborted":
          break;
        case "error":
          setError(result.message);
          break;
        case "success":
          snackbars.enqueue({
            message: `Camera "${cameraToDelete.shortName}" deleted successfully`,
            key: "camera-delete-success",
          });
          refetch();
          onClose();
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const hasRecordings = cameraToDelete.streams.some((stream) => stream?.record);

  return (
    <Dialog open={true} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Camera</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" sx={{ mb: 2 }}>
          Are you sure you want to delete the camera "{cameraToDelete.shortName}
          "?
        </Typography>

        {hasRecordings && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This camera has recording streams
              configured. Deleting the camera will also remove all associated
              recordings and configuration. This action cannot be undone.
            </Typography>
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Camera details:
          </Typography>
          <Typography variant="body2" sx={{ ml: 2 }}>
            • Name: {cameraToDelete.shortName}
          </Typography>
          {cameraToDelete.description && (
            <Typography variant="body2" sx={{ ml: 2 }}>
              • Description: {cameraToDelete.description}
            </Typography>
          )}
          <Typography variant="body2" sx={{ ml: 2 }}>
            • UUID: {cameraToDelete.uuid}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={submitting}
        >
          {submitting ? "Deleting..." : "Delete Camera"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteDialog;
