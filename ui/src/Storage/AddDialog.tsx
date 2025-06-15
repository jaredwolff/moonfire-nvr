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
  TextField,
  Alert,
  Box,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import * as api from "../api";
import { useSnackbars } from "../snackbars";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  csrf?: string;
}

interface FormData {
  path: string;
}

const AddDialog = ({ open, onClose, onSuccess, csrf }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snackbars = useSnackbars();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      path: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.addStorageDir(
        {
          csrf,
          path: data.path,
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
            message: "Storage directory added successfully",
            key: "storage-add-success",
          });
          onSuccess();
          onClose();
          reset();
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
      reset();
      setError(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Add Storage Directory</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 1 }}>
            <Controller
              name="path"
              control={control}
              rules={{
                required: "Path is required",
                validate: (value) => {
                  if (!value.startsWith("/")) {
                    return "Path must be absolute (start with /)";
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Directory Path"
                  fullWidth
                  placeholder="/var/lib/moonfire-nvr/sample"
                  error={!!errors.path}
                  helperText={
                    errors.path?.message ||
                    "Absolute path to the directory where recordings will be stored"
                  }
                  disabled={submitting}
                />
              )}
            />
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <strong>Important:</strong>
            <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
              <li>The directory must exist and be writable by Moonfire NVR</li>
              <li>Use a dedicated directory for each storage location</li>
              <li>Ensure sufficient disk space for recordings</li>
              <li>Consider using separate drives for better performance</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Adding..." : "Add Directory"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddDialog;
