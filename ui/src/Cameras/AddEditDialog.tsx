// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2024 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useForm, Controller } from "react-hook-form";
import * as api from "../api";
import { useSnackbars } from "../snackbars";
import { CameraManagement } from "../types";

interface Props {
  prior: CameraManagement | null;
  onClose: () => void;
  refetch: () => void;
  csrf?: string;
  storageDirs?: api.FetchResult<api.StorageDirsResponse>;
}

interface FormData {
  shortName: string;
  description: string;
  onvifBaseUrl: string;
  username: string;
  password: string;
  streams: {
    url: string;
    record: boolean;
    flushIfSec: number;
    rtspTransport: string;
    sampleFileDirId: number | null;
    retainBytes: number;
  }[];
}

const STREAM_TYPES = ["main", "sub", "ext"];
const RTSP_TRANSPORTS = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
];

const AddEditDialog = ({
  prior,
  onClose,
  refetch,
  csrf,
  storageDirs,
}: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingStream, setTestingStream] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<
    Record<number, { success: boolean; message: string }>
  >({});
  const snackbars = useSnackbars();
  const isAdd = prior === null;

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({
    defaultValues: {
      shortName: prior?.shortName || "",
      description: prior?.description || "",
      onvifBaseUrl: prior?.onvifBaseUrl || "",
      username: prior?.username || "",
      password: prior?.password || "",
      streams: STREAM_TYPES.map((_, index) => ({
        url: prior?.streams[index]?.url || "",
        record: prior?.streams[index]?.record || false,
        flushIfSec: prior?.streams[index]?.flushIfSec || 120,
        rtspTransport: prior?.streams[index]?.rtspTransport || "tcp",
        sampleFileDirId: prior?.streams[index]?.sampleFileDirId ?? null,
        retainBytes: prior?.streams[index]?.retainBytes || 0,
      })),
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError(null);

    try {
      const cameraSubset: api.CameraSubset = {
        shortName: data.shortName,
        description: data.description,
        onvifBaseUrl: data.onvifBaseUrl,
        username: data.username,
        password: data.password,
        streams: data.streams.map(
          (stream): api.StreamSubset => ({
            url: stream.url || undefined,
            record: stream.record,
            flushIfSec: stream.flushIfSec,
            rtspTransport: stream.rtspTransport,
            sampleFileDirId: stream.sampleFileDirId,
            retainBytes: stream.retainBytes,
          })
        ),
      };

      let result;
      if (isAdd) {
        result = await api.addCamera(
          {
            csrf,
            camera: cameraSubset,
          },
          {}
        );
      } else {
        result = await api.updateCamera(
          prior!.uuid,
          {
            csrf,
            update: cameraSubset,
          },
          {}
        );
      }

      switch (result.status) {
        case "aborted":
          break;
        case "error":
          setError(result.message);
          break;
        case "success":
          snackbars.enqueue({
            message: `Camera ${isAdd ? "added" : "updated"} successfully`,
            key: `camera-${isAdd ? "add" : "edit"}-success`,
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

  const testStreamConnection = async (streamIndex: number) => {
    if (!prior?.uuid) {
      snackbars.enqueue({
        message: "Cannot test stream on unsaved camera",
      });
      return;
    }

    const streamData = watch(`streams.${streamIndex}`);
    if (!streamData.url) {
      snackbars.enqueue({
        message: "Please enter a stream URL before testing",
      });
      return;
    }

    setTestingStream(streamIndex);
    setTestResults((prev) => {
      const newResults = { ...prev };
      delete newResults[streamIndex];
      return newResults;
    });

    try {
      const streamType = ["main", "sub", "ext"][streamIndex] as api.StreamType;
      const result = await api.testCamera(
        prior.uuid,
        {
          csrf,
          streamType,
        },
        {}
      );

      switch (result.status) {
        case "aborted":
          break;
        case "error":
          setTestResults((prev) => ({
            ...prev,
            [streamIndex]: { success: false, message: result.message },
          }));
          break;
        case "success":
          setTestResults((prev) => ({
            ...prev,
            [streamIndex]: result.response,
          }));
          if (result.response.success) {
            snackbars.enqueue({
              message: `Stream ${streamIndex + 1} test successful`,
            });
          }
          break;
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [streamIndex]: {
          success: false,
          message:
            err instanceof Error ? err.message : "Unknown error occurred",
        },
      }));
    } finally {
      setTestingStream(null);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{isAdd ? "Add Camera" : "Edit Camera"}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="shortName"
                  control={control}
                  rules={{ required: "Camera name is required" }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Camera Name"
                      fullWidth
                      error={!!errors.shortName}
                      helperText={errors.shortName?.message}
                      disabled={submitting}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description"
                      fullWidth
                      multiline
                      rows={2}
                      disabled={submitting}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="onvifBaseUrl"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="ONVIF Base URL"
                      fullWidth
                      placeholder="http://192.168.1.100:80"
                      disabled={submitting}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={6}>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Username"
                      fullWidth
                      disabled={submitting}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={6}>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Password"
                      type="password"
                      fullWidth
                      disabled={submitting}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
              Stream Configuration
            </Typography>

            {STREAM_TYPES.map((streamType, index) => (
              <Accordion key={streamType} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>
                    {streamType.charAt(0).toUpperCase() + streamType.slice(1)}{" "}
                    Stream
                    {watch(`streams.${index}.record`) && (
                      <Typography
                        component="span"
                        sx={{ ml: 1, color: "success.main", fontSize: "0.8em" }}
                      >
                        (Recording)
                      </Typography>
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Controller
                        name={`streams.${index}.url`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="RTSP URL"
                            fullWidth
                            placeholder="rtsp://192.168.1.100:554/stream1"
                            disabled={submitting}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <Controller
                        name={`streams.${index}.record`}
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                disabled={submitting}
                              />
                            }
                            label="Enable Recording"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <Controller
                        name={`streams.${index}.rtspTransport`}
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>RTSP Transport</InputLabel>
                            <Select
                              {...field}
                              label="RTSP Transport"
                              disabled={submitting}
                            >
                              {RTSP_TRANSPORTS.map((transport) => (
                                <MenuItem
                                  key={transport.value}
                                  value={transport.value}
                                >
                                  {transport.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <Controller
                        name={`streams.${index}.flushIfSec`}
                        control={control}
                        rules={{
                          min: { value: 0, message: "Must be non-negative" },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="Flush Interval (seconds)"
                            type="number"
                            fullWidth
                            error={!!errors.streams?.[index]?.flushIfSec}
                            helperText={
                              errors.streams?.[index]?.flushIfSec?.message
                            }
                            disabled={submitting}
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <Controller
                        name={`streams.${index}.sampleFileDirId`}
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel>Storage Directory</InputLabel>
                            <Select
                              {...field}
                              label="Storage Directory"
                              disabled={
                                submitting ||
                                !storageDirs ||
                                storageDirs.status === "error"
                              }
                              value={field.value ?? ""}
                            >
                              <MenuItem value="">
                                <em>No storage directory</em>
                              </MenuItem>
                              {storageDirs === undefined && (
                                <MenuItem value="" disabled>
                                  Loading storage directories...
                                </MenuItem>
                              )}
                              {storageDirs?.status === "error" && (
                                <MenuItem value="" disabled>
                                  Error loading storage directories
                                </MenuItem>
                              )}
                              {storageDirs?.status === "success" &&
                                storageDirs.response.dirs.map((dir) => (
                                  <MenuItem key={dir.id} value={dir.id}>
                                    {dir.path}
                                  </MenuItem>
                                ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>

                    <Grid item xs={6}>
                      <Controller
                        name={`streams.${index}.retainBytes`}
                        control={control}
                        rules={{
                          min: { value: 0, message: "Must be non-negative" },
                        }}
                        render={({ field }) => {
                          const [displayValue, setDisplayValue] =
                            React.useState(() => {
                              if (field.value && field.value > 0) {
                                return (
                                  field.value /
                                  (1024 * 1024 * 1024)
                                ).toString();
                              }
                              return "";
                            });

                          // Update display value when field value changes
                          React.useEffect(() => {
                            if (
                              field.value === 0 ||
                              field.value === null ||
                              field.value === undefined
                            ) {
                              setDisplayValue("");
                            } else if (field.value > 0) {
                              setDisplayValue(
                                (field.value / (1024 * 1024 * 1024)).toString()
                              );
                            }
                          }, [field.value]);

                          // Initialize display value when component mounts with existing data
                          React.useEffect(() => {
                            if (field.value && field.value > 0) {
                              setDisplayValue(
                                (field.value / (1024 * 1024 * 1024)).toString()
                              );
                            }
                          }, []);

                          return (
                            <TextField
                              label="Storage Limit (GB)"
                              type="number"
                              fullWidth
                              error={!!errors.streams?.[index]?.retainBytes}
                              helperText={
                                errors.streams?.[index]?.retainBytes?.message ||
                                "Maximum storage for this stream (0 = unlimited)"
                              }
                              disabled={submitting}
                              value={displayValue}
                              onChange={(e) => {
                                setDisplayValue(e.target.value);
                                const gb = parseFloat(e.target.value) || 0;
                                field.onChange(gb * 1024 * 1024 * 1024);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                            />
                          );
                        }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          mt: 1,
                        }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={
                            testingStream === index ? (
                              <CircularProgress size={16} />
                            ) : (
                              <PlayArrowIcon />
                            )
                          }
                          onClick={() => testStreamConnection(index)}
                          disabled={
                            submitting ||
                            testingStream === index ||
                            !watch(`streams.${index}.url`) ||
                            isAdd
                          }
                        >
                          {testingStream === index
                            ? "Testing..."
                            : "Test Stream"}
                        </Button>
                        {isAdd && (
                          <Typography variant="caption" color="text.secondary">
                            Save camera first to test streams
                          </Typography>
                        )}
                      </Box>

                      {testResults[index] && (
                        <Alert
                          severity={
                            testResults[index].success ? "success" : "error"
                          }
                          sx={{ mt: 1 }}
                        >
                          <Typography variant="subtitle2" gutterBottom>
                            Test{" "}
                            {testResults[index].success
                              ? "Successful"
                              : "Failed"}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="pre"
                            sx={{
                              whiteSpace: "pre-wrap",
                              fontFamily: "monospace",
                              fontSize: "0.8em",
                            }}
                          >
                            {testResults[index].message}
                          </Typography>
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Saving..." : isAdd ? "Add Camera" : "Save Changes"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddEditDialog;
